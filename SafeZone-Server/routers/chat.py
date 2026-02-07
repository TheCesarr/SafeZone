from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from database import get_db_connection, DB_NAME
from utils import log_event
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
async def get_channel_messages(channel_id: str, token: str):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Get Messages
        c.execute('''
            SELECT cm.id, cm.content, cm.timestamp, cm.attachment_url, cm.attachment_type, cm.attachment_name, cm.edited_at, u.username as sender
            FROM channel_messages cm
            JOIN users u ON cm.sender_id = u.id
            WHERE cm.channel_id = ?
            ORDER BY cm.timestamp ASC
            LIMIT 1000
        ''', (channel_id,))
        
        messages = []
        for row in c.fetchall():
            messages.append({
                "id": row['id'],
                "sender": row['sender'],
                "text": row['content'],
                "timestamp": row['timestamp'],
                "attachment_url": row['attachment_url'],
                "attachment_type": row['attachment_type'],
                "attachment_name": row['attachment_name'],
                "edited_at": row['edited_at']
            })
            
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
            
        # Verify ownership
        c.execute("SELECT sender_id FROM channel_messages WHERE id = ?", (message_id,))
        msg = c.fetchone()
        if not msg or msg['sender_id'] != user['id']:
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
            
        # Verify ownership or admin (TODO: Admin check)
        c.execute("SELECT sender_id FROM channel_messages WHERE id = ?", (message_id,))
        msg = c.fetchone()
        if not msg or msg['sender_id'] != user['id']:
            conn.close()
            return {"status": "error", "message": "Unauthorized"}
            
        c.execute("DELETE FROM channel_messages WHERE id = ?", (message_id,))
        conn.commit()
        conn.close()
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
                        conn = sqlite3.connect(DB_NAME)
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
    # Initialize with default audio state
    conn_info = {
        'ws': websocket, 
        'user_id': user_id,
        'is_muted': False,
        'is_deafened': False
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
                                (channel_id, sender_id, content, attachment_url, attachment_type, attachment_name) 
                                VALUES (?, ?, ?, ?, ?, ?)''', 
                              (room_id, user_row['id'], data.get('text', ""), 
                               data.get('attachment_url'), data.get('attachment_type'), data.get('attachment_name')))
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
