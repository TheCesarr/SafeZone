from typing import List, Dict
from fastapi import WebSocket
import json
import sqlite3
import datetime
from database import DB_NAME

# --- Classes ---
class VoiceRoom:
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self.active_connections: List[Dict] = [] 

class Lobby:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

# --- Global Instances ---
rooms: Dict[str, VoiceRoom] = {
    "sohbet-1": VoiceRoom("sohbet-1", "💬 Genel Sohbet"),
    "oyun-1":   VoiceRoom("oyun-1",   "🎮 Valorant Ekibi"),
    "oyun-2":   VoiceRoom("oyun-2",   "⛏️ Minecraft"),
    "muzik-1":  VoiceRoom("muzik-1",  "🎵 Müzik Odası"),
    "afk-1":    VoiceRoom("afk-1",    "💤 AFK"),
}

lobby = Lobby()

# --- Broadcast Helpers ---

async def broadcast_room_update():
    # 1. Global Online Users
    online_usernames = list(lobby.active_connections.keys())
    
    # Fetch status for these users from DB
    users_with_status = []
    if online_usernames:
        placeholders = ','.join('?' for _ in online_usernames)
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(f"SELECT username, status, display_name, avatar_url, avatar_color, discriminator FROM users WHERE username IN ({placeholders})", online_usernames)
        rows = c.fetchall()
        
        for row in rows:
            users_with_status.append(dict(row))
        conn.close()

    # 2. Room Details (Who is in which room)
    room_details = {}
    for r_id, r in rooms.items():
        room_details[r_id] = [u['user_id'] for u in r.active_connections]

    message = json.dumps({
        "type": "lobby_update",
        "total_online": len(online_usernames),
        "online_users": users_with_status,
        "room_details": room_details
    })
    
    to_remove = []
    for user_id, ws in lobby.active_connections.items():
        try:
            await ws.send_text(message)
        except:
            to_remove.append(user_id)
    
    for user_id in to_remove:
        del lobby.active_connections[user_id]

async def broadcast_lobby_update():
    """Broadcast server list update to all lobby users."""
    await broadcast_room_update()  # This already handles lobby updates

async def broadcast_user_list(room_id: str):
    """Notifies users IN a specific room about who is with them."""
    room = rooms.get(room_id)
    if not room: return
    
    # Send detailed user info
    users = []
    for conn in room.active_connections:
        users.append({
            "uuid": conn['user_id'],
            "is_muted": conn.get('is_muted', False),
            "is_deafened": conn.get('is_deafened', False)
        })

    message = { "type": "user_list", "users": users }
    
    for conn in room.active_connections:
        try:
            await conn['ws'].send_text(json.dumps(message))
        except:
            pass
