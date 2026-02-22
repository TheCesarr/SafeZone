from fastapi import APIRouter
from models import ChannelCreate, ChannelRename, ChannelDelete
from database import get_db_connection
from utils import log_event, check_permission, create_audit_log, PERM_MANAGE_CHANNELS
from state import broadcast_lobby_update, broadcast_room_update
import uuid
import sqlite3

router = APIRouter(prefix="/channel", tags=["channel"])

@router.post("/create")
async def create_channel(data: ChannelCreate):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # 2. Check permission (MANAGE_CHANNELS)
        if not check_permission(user['id'], data.server_id, PERM_MANAGE_CHANNELS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Kanalları Yönet)"}
        
        # 3. Create Channel
        channel_id = str(uuid.uuid4())
        category_id = getattr(data, 'category_id', None)
        c.execute("INSERT INTO channels (id, server_id, name, type, category_id) VALUES (?, ?, ?, ?, ?)",
                 (channel_id, data.server_id, data.channel_name, data.channel_type, category_id))
        
        conn.commit()
        conn.close()
        
        log_event("CHANNEL", f"Channel created: {data.channel_name} ({channel_id}) in server {data.server_id}")
        
        # Broadcast lobby update to all server members
        await broadcast_lobby_update()
        
        return {"status": "success", "channel_id": channel_id}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@router.post("/rename")
async def rename_channel(data: ChannelRename):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # 2. Get channel's server and check ownership
        c.execute("SELECT server_id FROM channels WHERE id = ?", (data.channel_id,))
        channel = c.fetchone()
        if not channel:
            conn.close()
            return {"status": "error", "message": "Channel not found"}

        # Check Permission (MANAGE_CHANNELS)
        if not check_permission(user['id'], channel['server_id'], PERM_MANAGE_CHANNELS):
             conn.close()
             return {"status": "error", "message": "Yetkiniz yok! (Kanalları Yönet)"}
        
        c.execute("UPDATE channels SET name = ? WHERE id = ?", (data.new_name, data.channel_id))
        conn.commit()
        conn.close()
        
        await broadcast_room_update()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/delete")
async def delete_channel(data: ChannelDelete):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user: conn.close(); return {"status":"error", "message":"Invalid token"}
        
        c.execute("SELECT server_id FROM channels WHERE id = ?", (data.channel_id,))
        channel = c.fetchone()
        if not channel: conn.close(); return {"status":"error", "message":"Channel not found"}
        
        if not check_permission(user['id'], channel['server_id'], PERM_MANAGE_CHANNELS):
            conn.close(); return {"status":"error", "message":"Yetkiniz yok! (Kanalları Yönet)"}
            
        c.execute("DELETE FROM channel_messages WHERE channel_id = ?", (data.channel_id,))
        c.execute("DELETE FROM channels WHERE id = ?", (data.channel_id,))
        conn.commit()
        conn.close()
        
        await broadcast_lobby_update()
        return {"status":"success"}
    except Exception as e:
        return {"status":"error", "message":str(e)}

# --- FAZ 4: CATEGORY MANAGEMENT ---

@router.post("/category/create")
async def create_category(data: dict):
    """Create a channel category."""
    try:
        token = data.get('token')
        server_id = data.get('server_id')
        name = data.get('name')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_CHANNELS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        # Get next position
        c.execute("SELECT MAX(position) as max_pos FROM categories WHERE server_id = ?", (server_id,))
        row = c.fetchone()
        new_pos = (row['max_pos'] or 0) + 1
        
        cat_id = str(uuid.uuid4())
        c.execute("INSERT INTO categories (id, server_id, name, position) VALUES (?, ?, ?, ?)",
                  (cat_id, server_id, name, new_pos))
        conn.commit()
        conn.close()
        
        create_audit_log(server_id, user['id'], "CATEGORY_CREATE", "CATEGORY", cat_id, name)
        await broadcast_lobby_update()
        
        return {"status": "success", "category_id": cat_id, "position": new_pos}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/category/rename")
async def rename_category(data: dict):
    """Rename a category."""
    try:
        token = data.get('token')
        category_id = data.get('category_id')
        new_name = data.get('name')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute("SELECT server_id FROM categories WHERE id = ?", (category_id,))
        cat = c.fetchone()
        if not cat:
            conn.close()
            return {"status": "error", "message": "Category not found"}
        
        if not check_permission(user['id'], cat['server_id'], PERM_MANAGE_CHANNELS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("UPDATE categories SET name = ? WHERE id = ?", (new_name, category_id))
        conn.commit()
        conn.close()
        
        await broadcast_lobby_update()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/category/delete")
async def delete_category(data: dict):
    """Delete a category (channels move to uncategorized)."""
    try:
        token = data.get('token')
        category_id = data.get('category_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute("SELECT server_id FROM categories WHERE id = ?", (category_id,))
        cat = c.fetchone()
        if not cat:
            conn.close()
            return {"status": "error", "message": "Category not found"}
        
        if not check_permission(user['id'], cat['server_id'], PERM_MANAGE_CHANNELS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        # Move channels to uncategorized
        c.execute("UPDATE channels SET category_id = NULL WHERE category_id = ?", (category_id,))
        c.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        conn.commit()
        conn.close()
        
        await broadcast_lobby_update()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/reorder")
async def reorder_channels(data: dict):
    """Reorder channels and categories. Expects {token, server_id, channels: [{id, position, category_id}]}"""
    try:
        token = data.get('token')
        server_id = data.get('server_id')
        channels = data.get('channels', [])
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_CHANNELS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        for ch in channels:
            c.execute("UPDATE channels SET position = ?, category_id = ? WHERE id = ? AND server_id = ?",
                      (ch.get('position', 0), ch.get('category_id'), ch['id'], server_id))
        
        conn.commit()
        conn.close()
        
        await broadcast_lobby_update()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
