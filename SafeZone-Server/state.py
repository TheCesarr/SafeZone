from typing import List, Dict
from fastapi import WebSocket
import json
import asyncio
from database import get_db_connection

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
# Rooms are created dynamically when users join voice channels (see chat.py room_endpoint)
rooms: Dict[str, VoiceRoom] = {}

lobby = Lobby()

# ── In-Memory User Status Cache ──────────────────────────────────────────────
# Instead of querying the DB on every broadcast, we maintain an in-memory cache
# of online users' display data. The cache is updated when:
#   - A user connects to the lobby (set from DB)
#   - A user changes their status (updated via WS message)
#   - A user disconnects (removed from cache)
#
# Structure: { username: { username, status, preferred_status, custom_status,
#                           display_name, avatar_url, avatar_color, discriminator } }
_user_cache: Dict[str, dict] = {}


def cache_user_status(username: str, data: dict = None):
    """
    Populate or update the in-memory cache for a user.
    If `data` is None, fetch from DB (used on first connect).
    """
    if data is not None:
        _user_cache[username] = data
        return

    # Fetch from DB on first connect
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute(
            "SELECT username, status, preferred_status, custom_status, "
            "display_name, avatar_url, avatar_color, discriminator "
            "FROM users WHERE username = ?",
            (username,)
        )
        row = c.fetchone()
        conn.close()
        if row:
            _user_cache[username] = dict(row)
    except Exception:
        pass


def update_cached_status(username: str, status: str, preferred_status: str = None):
    """Update only the status fields in cache (no DB query needed)."""
    if username in _user_cache:
        _user_cache[username]['status'] = status
        if preferred_status is not None:
            _user_cache[username]['preferred_status'] = preferred_status


def remove_cached_user(username: str):
    """Remove user from cache on disconnect."""
    _user_cache.pop(username, None)


# ── Debounced Broadcast ──────────────────────────────────────────────────────
# Multiple rapid events (e.g. 5 users joining simultaneously) are coalesced
# into a single broadcast after a short delay, reducing WebSocket traffic.
_broadcast_task: asyncio.Task = None
_BROADCAST_DEBOUNCE_MS = 150  # 150ms debounce window


async def _debounced_broadcast():
    """Wait for debounce window then perform the actual broadcast."""
    await asyncio.sleep(_BROADCAST_DEBOUNCE_MS / 1000.0)
    await _do_broadcast()


async def broadcast_room_update():
    """
    Schedule a debounced lobby broadcast.
    If called multiple times within 150ms, only the last one fires.
    """
    global _broadcast_task
    # Cancel any pending broadcast
    if _broadcast_task and not _broadcast_task.done():
        _broadcast_task.cancel()
    _broadcast_task = asyncio.create_task(_debounced_broadcast())


async def _do_broadcast():
    """
    Actual broadcast logic — reads from in-memory cache (no DB query).
    Builds the JSON payload once and sends it to all lobby connections.
    """
    # 1. Online Users — read from cache (no SQL!)
    online_usernames = list(lobby.active_connections.keys())
    users_with_status = []
    for uname in online_usernames:
        cached = _user_cache.get(uname)
        if cached:
            users_with_status.append(cached)

    # 2. Room Details (Who is in which room)
    room_details = {}
    for r_id, r in rooms.items():
        if r.active_connections:  # Skip empty rooms
            room_details[r_id] = [u['user_id'] for u in r.active_connections]

    # 3. Build JSON once, send to all
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
        except Exception:
            to_remove.append(user_id)
    
    for user_id in to_remove:
        lobby.active_connections.pop(user_id, None)
        remove_cached_user(user_id)


async def broadcast_lobby_update():
    """Broadcast server list update to all lobby users."""
    await broadcast_room_update()


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
            "is_deafened": conn.get('is_deafened', False),
            "is_screen_sharing": conn.get('is_screen_sharing', False)
        })

    message = json.dumps({ "type": "user_list", "users": users })
    
    for conn in room.active_connections:
        try:
            await conn['ws'].send_text(message)
        except Exception:
            pass
