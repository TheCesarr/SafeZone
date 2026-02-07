from fastapi import APIRouter
from models import ChannelCreate, ChannelRename, ChannelDelete
from database import get_db_connection
from utils import log_event
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
        
        # 2. Check if user is server owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (data.server_id,))
        server = c.fetchone()
        if not server:
            conn.close()
            return {"status": "error", "message": "Server not found"}
        
        if server['owner_id'] != user['id']:
            conn.close()
            return {"status": "error", "message": "Only server owner can create channels"}
        
        # 3. Create Channel
        channel_id = str(uuid.uuid4())
        c.execute("INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)",
                 (channel_id, data.server_id, data.channel_name, data.channel_type))
        
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

        # Check Owner or Manage Channels Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (channel['server_id'],))
        server = c.fetchone()
        
        # Note: We will add permission check helper later. For now owner only.
        if server['owner_id'] != user['id']:
             conn.close()
             return {"status": "error", "message": "Yetkiniz yok!"}
        
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
        
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (channel['server_id'],))
        server = c.fetchone()
        if server['owner_id'] != user['id']:
            conn.close(); return {"status":"error", "message":"Yetkisiz"}
            
        c.execute("DELETE FROM channel_messages WHERE channel_id = ?", (data.channel_id,))
        c.execute("DELETE FROM channels WHERE id = ?", (data.channel_id,))
        conn.commit()
        conn.close()
        
        await broadcast_lobby_update()
        return {"status":"success"}
    except Exception as e:
        return {"status":"error", "message":str(e)}
