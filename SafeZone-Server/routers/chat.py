from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from database import get_db_connection, DB_NAME
from utils import log_event, check_permission, create_audit_log, PERM_MANAGE_MESSAGES
from state import lobby, rooms, VoiceRoom, broadcast_room_update, broadcast_user_list
import sqlite3
import json
import uuid
import os
import re
import urllib.request
import datetime

router = APIRouter(tags=["chat"])

# --- Helper ---
async def broadcast(room, message: str):
    for conn in room.active_connections:
        try:
            await conn['ws'].send_text(message)
        except:
            pass # Handle disconnected clients

# --- HTTP Endpoints ---

@router.get("/channel/{channel_id}/messages")
async def get_channel_messages(channel_id: str, token: str, before: int = None, limit: int = 100):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Get Messages (with pagination)
        if before:
            c.execute('''
                SELECT cm.id, cm.content, cm.timestamp, cm.attachment_url, cm.attachment_type, 
                       cm.attachment_name, cm.edited_at, cm.reply_to_id, cm.is_pinned, u.username as sender
                FROM channel_messages cm
                JOIN users u ON cm.sender_id = u.id
                WHERE cm.channel_id = ? AND cm.id < ?
                ORDER BY cm.timestamp DESC
                LIMIT ?
            ''', (channel_id, before, min(limit, 100)))
        else:
            c.execute('''
                SELECT cm.id, cm.content, cm.timestamp, cm.attachment_url, cm.attachment_type, 
                       cm.attachment_name, cm.edited_at, cm.reply_to_id, cm.is_pinned, u.username as sender
                FROM channel_messages cm
                JOIN users u ON cm.sender_id = u.id
                WHERE cm.channel_id = ?
                ORDER BY cm.timestamp DESC
                LIMIT ?
            ''', (channel_id, min(limit, 100)))
        
        rows = c.fetchall()
        msg_ids = [row['id'] for row in rows]
        
        # 3. Fetch reactions for these messages
        reactions_map = {}
        if msg_ids:
            placeholders = ','.join(['?'] * len(msg_ids))
            c.execute(f'''
                SELECT mr.message_id, mr.emoji, u.username
                FROM message_reactions mr
                JOIN users u ON mr.user_id = u.id
                WHERE mr.message_id IN ({placeholders})
            ''', msg_ids)
            for r in c.fetchall():
                mid = r['message_id']
                if mid not in reactions_map:
                    reactions_map[mid] = {}
                emoji = r['emoji']
                if emoji not in reactions_map[mid]:
                    reactions_map[mid][emoji] = []
                reactions_map[mid][emoji].append(r['username'])
        
        # 4. Fetch reply-to info
        reply_ids = [row['reply_to_id'] for row in rows if row['reply_to_id']]
        reply_map = {}
        if reply_ids:
            placeholders = ','.join(['?'] * len(reply_ids))
            c.execute(f'''
                SELECT cm.id, cm.content, u.username as sender
                FROM channel_messages cm
                JOIN users u ON cm.sender_id = u.id
                WHERE cm.id IN ({placeholders})
            ''', reply_ids)
            for r in c.fetchall():
                reply_map[r['id']] = {"id": r['id'], "sender": r['sender'], "text": r['content'][:100]}
        
        messages = []
        for row in rows:
            msg = {
                "id": row['id'],
                "sender": row['sender'],
                "text": row['content'],
                "timestamp": row['timestamp'],
                "attachment_url": row['attachment_url'],
                "attachment_type": row['attachment_type'],
                "attachment_name": row['attachment_name'],
                "edited_at": row['edited_at'],
                "is_pinned": bool(row['is_pinned']),
                "reactions": reactions_map.get(row['id'], {}),
                "reply_to": reply_map.get(row['reply_to_id'])
            }
            messages.append(msg)
        
        messages.reverse()  # Back to chronological order
            
        conn.close()
        return {"status": "success", "messages": messages}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/chat/upload")
async def chat_upload(token: str = Form(...), file: UploadFile = File(...)):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Save File
        file_ext = file.filename.split('.')[-1]
        filename = f"chat_{user['id']}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
            
        url = f"/uploads/{filename}"
        
        # Determine type
        ftype = 'file'
        if file_ext.lower() in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            ftype = 'image'
        elif file_ext.lower() in ['mp4', 'webm', 'mov']:
            ftype = 'video'
            
        conn.close()
        return {
            "status": "success", 
            "url": url, 
            "type": ftype, 
            "name": file.filename
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/message/edit")
async def edit_message(data: dict):
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        new_content = data.get('content')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user: 
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # Verify ownership or SysAdmin
        c.execute("SELECT sender_id FROM channel_messages WHERE id = ?", (message_id,))
        msg = c.fetchone()

        is_owner = msg and msg['sender_id'] == user['id']
        is_sysadmin = user.get('is_sysadmin')

        if not msg or (not is_owner and not is_sysadmin):
            conn.close()
            return {"status": "error", "message": "Unauthorized"}
            
        c.execute("UPDATE channel_messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?", 
                 (new_content, message_id))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/message/delete")
async def delete_message(data: dict):
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user: return {"status": "error"}
            
        # Get the message details
        c.execute("SELECT sender_id, channel_id FROM channel_messages WHERE id = ?", (message_id,))
        msg = c.fetchone()
        if not msg:
            conn.close()
            return {"status": "error", "message": "Message not found"}
        
        # Check: either message owner OR has MANAGE_MESSAGES permission
        is_owner = msg['sender_id'] == user['id']
        
        if not is_owner:
            # Get server_id from channel
            c.execute("SELECT server_id FROM channels WHERE id = ?", (msg['channel_id'],))
            channel = c.fetchone()
            if not channel or not check_permission(user['id'], channel['server_id'], PERM_MANAGE_MESSAGES):
                conn.close()
                return {"status": "error", "message": "Yetkiniz yok!"}
            
        c.execute("DELETE FROM channel_messages WHERE id = ?", (message_id,))
        conn.commit()
        conn.close()
        
        # Broadcast Deletion
        from state import rooms
        channel_id_str = str(msg['channel_id'])
        
        # LOGGING
        log_event("DEBUG", f"Attempting to broadcast delete for channel {channel_id_str}. Active rooms: {list(rooms.keys())}")
        
        if channel_id_str in rooms:
            import json
            deletion_event = json.dumps({
                "type": "message_deleted",
                "message_id": message_id,
                "channel_id": channel_id_str
            })
            log_event("DEBUG", f"Broadcasting deletion to {len(rooms[channel_id_str].active_connections)} clients")
            for connection in rooms[channel_id_str].active_connections:
                try:
                    await connection['ws'].send_text(deletion_event)
                except Exception as e:
                    log_event("ERROR", f"Failed to send delete event: {e}")
        
        # For Text Channels, we don't have a "Room" object in memory usually unless we have a specific websocket for it.
        # SafeZone seems to use `lobby` for global updates, OR `room_endpoint` for specific rooms.
        # If the user is in a textual channel, are they connected to a websocket?
        # `useChat` connects to `chatWs`. Let's check `useChat` implementation.
        # `useChat` connects to `/ws/room/${channelId}/${uuid}`.
        # So yes, they are in `rooms`.
        
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/utils/link-preview")
async def link_preview(data: dict):
    url = data.get('url')
    if not url: return {"status": "error"}
    
    try:
        # Simple regex-based scraper (No external deps)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; SafeZone/1.0)'})
        with urllib.request.urlopen(req, timeout=5) as response:
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' not in content_type:
                return {"status": "error", "message": "Not HTML"}
                
            html = response.read().decode('utf-8', errors='ignore')
            
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            title = title_match.group(1).strip() if title_match else url
            
            # OpenGraph Image
            og_image = re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
            image = og_image.group(1) if og_image else None
            
            # Description
            desc_match = re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', html, re.IGNORECASE)
            description = desc_match.group(1) if desc_match else ""
            
            return {
                "status": "success",
                "title": title,
                "image": image,
                "description": description[:200], # Limit length
                "url": url
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- FAZ 3: CHAT ENRICHMENT ENDPOINTS ---

@router.post("/message/react")
async def react_to_message(data: dict):
    """Add or toggle a reaction on a message."""
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        emoji = data.get('emoji')
        
        if not emoji or not message_id:
            return {"status": "error", "message": "Missing data"}
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # Toggle: if already reacted, remove; otherwise add
        c.execute("SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
                  (message_id, user['id'], emoji))
        existing = c.fetchone()
        
        if existing:
            c.execute("DELETE FROM message_reactions WHERE id = ?", (existing['id'],))
            action = "removed"
        else:
            c.execute("INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)",
                      (message_id, user['id'], emoji))
            action = "added"
        
        conn.commit()
        
        # Get updated reactions for this message
        c.execute('''
            SELECT mr.emoji, u.username 
            FROM message_reactions mr 
            JOIN users u ON mr.user_id = u.id 
            WHERE mr.message_id = ?
        ''', (message_id,))
        
        reactions = {}
        for r in c.fetchall():
            if r['emoji'] not in reactions:
                reactions[r['emoji']] = []
            reactions[r['emoji']].append(r['username'])
        
        conn.close()
        return {"status": "success", "action": action, "reactions": reactions, "message_id": message_id}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/message/pin")
async def pin_message(data: dict):
    """Pin or unpin a message."""
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # Get message + channel
        c.execute("SELECT channel_id, is_pinned FROM channel_messages WHERE id = ?", (message_id,))
        msg = c.fetchone()
        if not msg:
            conn.close()
            return {"status": "error", "message": "Message not found"}
        
        # Permission check: MANAGE_MESSAGES
        c.execute("SELECT server_id FROM channels WHERE id = ?", (msg['channel_id'],))
        channel = c.fetchone()
        if channel and not check_permission(user['id'], channel['server_id'], PERM_MANAGE_MESSAGES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        # Toggle pin
        new_pin = 0 if msg['is_pinned'] else 1
        c.execute("UPDATE channel_messages SET is_pinned = ? WHERE id = ?", (new_pin, message_id))
        conn.commit()
        conn.close()
        
        action = "MESSAGE_PIN" if new_pin else "MESSAGE_UNPIN"
        if channel:
            create_audit_log(channel['server_id'], user['id'], action, "MESSAGE", str(message_id))
        
        return {"status": "success", "is_pinned": bool(new_pin)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/channel/{channel_id}/pins")
async def get_pinned_messages(channel_id: str, token: str):
    """Get all pinned messages in a channel."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute('''
            SELECT cm.id, cm.content, cm.timestamp, u.username as sender
            FROM channel_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.channel_id = ? AND cm.is_pinned = 1
            ORDER BY cm.timestamp DESC
        ''', (channel_id,))
        
        pins = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "pins": pins}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/channel/{channel_id}/search")
async def search_messages(channel_id: str, token: str, q: str, limit: int = 25):
    """Search messages in a channel."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not q or len(q) < 2:
            conn.close()
            return {"status": "error", "message": "Arama en az 2 karakter olmalı"}
        
        c.execute('''
            SELECT cm.id, cm.content, cm.timestamp, u.username as sender
            FROM channel_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.channel_id = ? AND cm.content LIKE ?
            ORDER BY cm.timestamp DESC
            LIMIT ?
        ''', (channel_id, f'%{q}%', min(limit, 50)))
        
        results = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "results": results, "count": len(results)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- WebSockets ---

@router.websocket("/ws/lobby/{user_id}")
async def lobby_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()
    
    # De-duplicate: If user already connected, remove old connection
    if user_id in lobby.active_connections:
        try:
            old_ws = lobby.active_connections[user_id]
            await old_ws.close()
        except:
            pass
            
    lobby.active_connections[user_id] = websocket
    log_event("LOBBY", f"Lobby connection: {user_id}. Total: {len(lobby.active_connections)}")

    # FORCE ONLINE STATUS
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("UPDATE users SET status = 'online' WHERE username = ?", (user_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        log_event("ERROR", f"Status update error: {e}")
    
    await broadcast_room_update()
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                
                if msg.get('type') == 'ping':
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": msg.get("timestamp")
                    }))
                    
                # HANDLE STATUS UPDATE
                elif msg.get('type') == 'status_update':
                    new_status = msg.get('status')
                    if new_status in ['online', 'idle', 'dnd', 'invisible']:
                        # Update DB
                        conn = get_db_connection()
                        c = conn.cursor()
                        # Find username from token logic or passed user_id (here user_id is username)
                        c.execute("UPDATE users SET status = ? WHERE username = ?", (new_status, user_id))
                        conn.commit()
                        conn.close()
                        
                        # Broadcast update
                        await broadcast_room_update()
                        
            except Exception as e:
                log_event("ERROR", f"Lobby msg error: {e}")
    except WebSocketDisconnect:
        if user_id in lobby.active_connections and lobby.active_connections[user_id] == websocket:
            del lobby.active_connections[user_id]
        
        # SET OFFLINE
        try:
            conn = get_db_connection()
            c = conn.cursor()
            c.execute("UPDATE users SET status = 'offline' WHERE username = ?", (user_id,))
            conn.commit()
            conn.close()
        except: pass

        await broadcast_room_update()


@router.websocket("/ws/room/{room_id}/{user_id}")
async def room_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    await websocket.accept()
    
    # 1. Check if room exists in memory
    if room_id not in rooms:
        # 2. If not, check DB (is it a valid server channel?)
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute("SELECT name FROM channels WHERE id = ?", (room_id,))
        channel = c.fetchone()
        conn.close()
        
        if channel:
            # Create dynamic room
            rooms[room_id] = VoiceRoom(room_id, channel[0])
            log_event("ROOM", f"Dynamic room created: {channel[0]} ({room_id})")
        else:
            await websocket.close()
            log_event("ERROR", f"Invalid Room ID: {room_id}")
            return

    room = rooms[room_id]

    # --- GHOST SESSION CLEANUP ---
    # If this user already has a connection in this room (e.g. reconnect after crash),
    # forcibly close and remove the old one to prevent duplicate entries.
    ghost_sessions = [c for c in room.active_connections if c['user_id'] == user_id]
    for ghost in ghost_sessions:
        try:
            await ghost['ws'].close()
        except:
            pass
        room.active_connections.remove(ghost)
        log_event("CLEANUP", f"Ghost session removed for {user_id} in {room.name}")

    # Initialize with default audio state
    conn_info = {
        'ws': websocket, 
        'user_id': user_id,
        'is_muted': False,
        'is_deafened': False,
        'is_screen_sharing': False
    }
    room.active_connections.append(conn_info)
    
    log_event("CONNECT", f"{user_id} --> {room.name}")
    
    await broadcast_room_update()
    await broadcast_user_list(room_id)
    
    if len(room.active_connections) > 1:
        await websocket.send_text(json.dumps({
            "type": "system",
            "action": "please_offer" 
        }))

    # --- SEND CHAT HISTORY ---
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT cm.content, cm.timestamp, u.username as sender
        FROM channel_messages cm
        JOIN users u ON cm.sender_id = u.id
        WHERE cm.channel_id = ?
        ORDER BY cm.timestamp ASC
        LIMIT 50
    ''', (room_id,))
    
    history_msgs = []
    for row in c.fetchall():
        history_msgs.append({
            "sender": row['sender'],
            "text": row['content']
        })
    conn.close()
    
    if history_msgs:
        await websocket.send_text(json.dumps({
            "type": "history",
            "messages": history_msgs
        }))
    # -------------------------
    
    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            
            # HANDLE CHAT (NEW)
            if data.get("type") == "chat":
                 # --- SAVE TO DB ---
                conn = get_db_connection()
                c = conn.cursor()
                c.execute("SELECT id FROM users WHERE username = ?", (data.get('sender', user_id),))
                user_row = c.fetchone()
                if user_row:
                    c.execute('''INSERT INTO channel_messages 
                                (channel_id, sender_id, content, attachment_url, attachment_type, attachment_name, reply_to_id) 
                                VALUES (?, ?, ?, ?, ?, ?, ?)''', 
                              (room_id, user_row['id'], data.get('text', ""), 
                               data.get('attachment_url'), data.get('attachment_type'), data.get('attachment_name'),
                               data.get('reply_to_id')))
                    conn.commit()
                conn.close()
                # ------------------
                # Broadcast
                await broadcast(room, json.dumps(data))
                continue

            # HANDLE TYPING
            if data.get("type") == "typing":
                await broadcast(room, json.dumps(data))
                continue

            # HANDLE USER STATE UPDATES
            if data.get("type") == "user_state":
                conn_info['is_muted'] = data.get("is_muted", False)
                conn_info['is_deafened'] = data.get("is_deafened", False)
                conn_info['is_screen_sharing'] = data.get("is_screen_sharing", False)
                # Broadcast new state to everyone in room
                await broadcast_user_list(room_id)
                continue 
            
            # Broadcast other messages (ICE, Offer, Answer, Chat) to peers
            for conn in room.active_connections:
                if conn['ws'] != websocket:
                    try:
                        await conn['ws'].send_text(data_str)
                    except:
                        pass
            
    except WebSocketDisconnect:
        if conn_info in room.active_connections:
            room.active_connections.remove(conn_info)
        
        log_event("DISCONNECT", f"{user_id} <-- {room.name}")
        await broadcast_room_update()
        await broadcast_user_list(room_id)
