from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
from typing import List, Dict
import datetime
import os
import uuid
import secrets
import sqlite3
import re
import urllib.request

app = FastAPI(title="SafeZone Backend", version="1.0.0")

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- In-Memory Database ---
class VoiceRoom:
    def __init__(self, id: str, name: str):
        self.id = id
        self.name = name
        self.active_connections: List[Dict] = [] 

class Lobby:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

rooms: Dict[str, VoiceRoom] = {
    "sohbet-1": VoiceRoom("sohbet-1", "💬 Genel Sohbet"),
    "oyun-1":   VoiceRoom("oyun-1",   "🎮 Valorant Ekibi"),
    "oyun-2":   VoiceRoom("oyun-2",   "⛏️ Minecraft"),
    "muzik-1":  VoiceRoom("muzik-1",  "🎵 Müzik Odası"),
    "afk-1":    VoiceRoom("afk-1",    "💤 AFK"),
}

lobby = Lobby()

# --- Logging Helper ---
LOG_FILE = "server_log.txt"

def log_event(event_type: str, message: str):
    time_str = datetime.datetime.now().strftime("%H:%M:%S")
    prefix = ""
    if event_type == "CONNECT":
        prefix = "[+] BAGLANDI"
    elif event_type == "DISCONNECT":
        prefix = "[-] AYRILDI "
    elif event_type == "ERROR":
        prefix = "[!] HATA    "
    else:
        prefix = f"[*] {event_type:<8}"
    
    log_line = f"{time_str} | {prefix} | {message}"
    print(log_line)
    
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
    except Exception as e:
        print(f"Log yazma hatasi: {e}")

# --- Helper Methods ---

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
        "online_users": users_with_status, # Send full objects instead of just strings
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

# --- Database & Auth Setup ---
# --- Database & Auth Setup ---
import sqlite3
import secrets
import bcrypt

DB_NAME = "safezone.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    token TEXT,
                    recovery_pin TEXT
                )''')
    
    # Migration: Add recovery_pin if missing (for existing dbs)
    try:
        c.execute("ALTER TABLE users ADD COLUMN recovery_pin TEXT")
    except:
        pass # Column already exists
    
    # Add discriminator column (Discord-style #1234 tag)
    try:
        c.execute("ALTER TABLE users ADD COLUMN discriminator TEXT DEFAULT '0001'")
    except:
        pass # Column already exists

    # Add avatar_color column
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#5865F2'")
    except:
        pass # Column already exists

    # Add avatar_url column
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
    except:
        pass # Column already exists
        
    # Add status column
    try:
        c.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'online'")
    except:
        pass # Column already exists
        
    # Servers
    c.execute('''CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id INTEGER NOT NULL,
                    invite_code TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )''')
    
    # Channels
    c.execute('''CREATE TABLE IF NOT EXISTS channels (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')
    
    # Members
    c.execute('''CREATE TABLE IF NOT EXISTS members (
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    role TEXT DEFAULT 'member',
                    PRIMARY KEY(server_id, user_id),
                    FOREIGN KEY(server_id) REFERENCES servers(id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
    
    # Friends table
    c.execute('''CREATE TABLE IF NOT EXISTS friends (
                    user_id INTEGER NOT NULL,
                    friend_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(user_id, friend_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(friend_id) REFERENCES users(id)
                )''')

    # DM Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_read BOOLEAN DEFAULT 0,
                    FOREIGN KEY(sender_id) REFERENCES users(id),
                    FOREIGN KEY(sender_id) REFERENCES users(id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id)
                )''')

    # ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    permissions INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')

    # USER_ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS user_roles (
                    user_id INTEGER NOT NULL,
                    role_id INTEGER NOT NULL,
                    server_id TEXT NOT NULL,
                    PRIMARY KEY(user_id, role_id, server_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(role_id) REFERENCES roles(id),
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')

    # Friend Requests table
    c.execute('''CREATE TABLE IF NOT EXISTS friend_requests (
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(sender_id, receiver_id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id)
                )''')
                
    # Server Channel Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS channel_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    sender_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(channel_id) REFERENCES channels(id),
                    FOREIGN KEY(sender_id) REFERENCES users(id)
                )''')
                
    # --- RICH CHAT UPGRADES ---
    # Add attachment columns
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_url TEXT")
    except: pass
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_type TEXT") # image, video, file
    except: pass
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_name TEXT")
    except: pass
    
    # Add editing columns
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN edited_at TIMESTAMP")
    except: pass
    # --------------------------

    conn.commit()
    conn.close()

init_db()

class UserRegister(BaseModel):
    username: str
    password: str
    display_name: str
    recovery_pin: str = ""

class UserLogin(BaseModel):
    username: str
    password: str
    
class UserReset(BaseModel):
    username: str
    recovery_pin: str
    new_password: str

class ServerCreate(BaseModel):
    token: str
    name: str

class ServerJoin(BaseModel):
    token: str
    invite_code: str

class DMSend(BaseModel):
    token: str
    receiver_username: str
    content: str

class ChannelCreate(BaseModel):
    token: str
    server_id: str
    channel_name: str
    channel_type: str  # "text" or "voice"

class ChannelRename(BaseModel):
    token: str
    channel_id: str
    new_name: str

class ChannelDelete(BaseModel):
    token: str
    channel_id: str

# --- Auth Endpoints ---

@app.post("/auth/register")
async def register(user: UserRegister):
    try:
        log_event("AUTH", f"Register attempt: {user.username}")
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Generate discriminator (4-digit number)
        # Find all existing discriminators for this username
        c.execute("SELECT discriminator FROM users WHERE username = ?", (user.username,))
        existing_discriminators = set(row['discriminator'] for row in c.fetchall())
        
        # Generate a unique discriminator (0001-9999)
        import random
        discriminator = None
        for attempt in range(100):  # Try 100 times
            candidate = str(random.randint(1, 9999)).zfill(4)
            if candidate not in existing_discriminators:
                discriminator = candidate
                break
        
        if not discriminator:
            # If all discriminators are taken for this username (very unlikely)
            conn.close()
            return {"status": "error", "message": "Bu kullanıcı adı çok popüler, başka bir isim deneyin."}
        
        # Hash password & Save
        # bcrypt.hashpw requires bytes, returns bytes
        hashed_pw_bytes = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
        hashed_pw_str = hashed_pw_bytes.decode('utf-8')
        
        # Generate initial token
        token = secrets.token_hex(16)
        
        c.execute("INSERT INTO users (username, password_hash, display_name, token, recovery_pin, discriminator) VALUES (?, ?, ?, ?, ?, ?)",
                  (user.username, hashed_pw_str, user.display_name, token, user.recovery_pin, discriminator))
        conn.commit()
            
        conn.close()
        log_event("AUTH", f"User registered: {user.username}#{discriminator}")
        return {"status": "success", "token": token, "username": user.username, "display_name": user.display_name, "discriminator": discriminator}
    except Exception as e:
        import traceback
        traceback.print_exc()
        log_event("ERROR", f"Register failed: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@app.post("/auth/login")
async def login(user: UserLogin):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM users WHERE username = ?", (user.username,))
        db_user = c.fetchone()
        
        if not db_user:
            conn.close()
            return {"status": "error", "message": "Kullanıcı adı veya şifre hatalı."}
            
        # Verify password
        # bcrypt.checkpw(password_bytes, hashed_bytes)
        stored_hash = db_user['password_hash'].encode('utf-8')
        if not bcrypt.checkpw(user.password.encode('utf-8'), stored_hash):
            conn.close()
            return {"status": "error", "message": "Kullanıcı adı veya şifre hatalı."}
        
        # Generate new token
        new_token = secrets.token_hex(16)
        c.execute("UPDATE users SET token = ? WHERE id = ?", (new_token, db_user['id']))
        conn.commit()
        conn.close()
        
        return {"status": "success", "token": new_token, "username": db_user['username'], "display_name": db_user['display_name'], "discriminator": db_user['discriminator'] or '0001'}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Login Error: {str(e)}"}

@app.post("/auth/verify")
async def verify_token(data: dict):
    try:
        # Simple token check
        token = data.get("token")
        if not token:
            return {"status": "error", "message": "No token"}
            
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT username, display_name, discriminator FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        conn.close()
        
        if user:
            return {"status": "success", "username": user['username'], "display_name": user['display_name'], "discriminator": user['discriminator'] or '0001'}
        else:
            return {"status": "error", "message": "Invalid token"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

# --- Server Management Endpoints ---
@app.post("/server/create")
async def create_server(data: ServerCreate):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # 2. Create Server
        server_id = str(uuid.uuid4())
        invite_code = secrets.token_hex(3).upper() # 6 char code
        
        c.execute("INSERT INTO servers (id, name, owner_id, invite_code) VALUES (?, ?, ?, ?)",
                 (server_id, data.name, user['id'], invite_code))
        
        # 3. Create Default Channels
        c.execute("INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)",
                 (str(uuid.uuid4()), server_id, "Genel Sohbet", "text"))
        c.execute("INSERT INTO channels (id, server_id, name, type) VALUES (?, ?, ?, ?)",
                 (str(uuid.uuid4()), server_id, "Ses Odası", "voice"))
                 
        # 4. Add Owner as Member
        c.execute("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, ?)",
                 (server_id, user['id'], 'owner'))
                 
        conn.commit()
        conn.close()
        
        log_event("SERVER", f"Server created: {data.name} ({server_id}) by user {user['id']}")
        return {"status": "success", "server_id": server_id, "invite_code": invite_code}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/server/list")
async def list_user_servers(token: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get User ID
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # Get Servers user is a member of
        c.execute('''
            SELECT s.id, s.name, s.invite_code 
            FROM servers s
            JOIN members m ON s.id = m.server_id
            WHERE m.user_id = ?
        ''', (user['id'],))
        
        servers = [dict(row) for row in c.fetchall()]
        
        # For each server, get channels (Simple approach for now)
        for s in servers:
            c.execute("SELECT id, name, type FROM channels WHERE server_id = ?", (s['id'],))
            s['channels'] = [dict(row) for row in c.fetchall()]
            
        conn.close()
        conn.close()
        return {"status": "success", "servers": servers}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/server/{server_id}/members")
async def get_server_members(server_id: str, token: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 1. Fetch Members with Details
        c.execute('''
            SELECT m.user_id, u.username, u.display_name, u.discriminator, u.avatar_url, u.avatar_color, u.status, m.role as legacy_role
            FROM members m
            JOIN users u ON m.user_id = u.id
            WHERE m.server_id = ?
        ''', (server_id,))
        members_raw = [dict(row) for row in c.fetchall()]

        # 2. Fetch all Server Roles
        c.execute("SELECT * FROM roles WHERE server_id = ?", (server_id,))
        server_roles = {r['id']: dict(r) for r in c.fetchall()} # id -> role dict

        # 3. Fetch User Role Assignments
        c.execute("SELECT user_id, role_id FROM user_roles WHERE server_id = ?", (server_id,))
        assignments = c.fetchall()
        
        # Map user_id -> list of role_ids
        user_role_map = {}
        for row in assignments:
            uid = row['user_id']
            rid = row['role_id']
            if uid not in user_role_map: user_role_map[uid] = []
            user_role_map[uid].append(rid)

        # 4. Enrich Members
        enriched_members = []
        for m in members_raw:
            uid = m['user_id']
            
            # Find highest role
            role_ids = user_role_map.get(uid, [])
            highest_role = None
            
            # Get actual role objects
            my_roles = [server_roles[rid] for rid in role_ids if rid in server_roles]
            
            if my_roles:
                # Sort by position (Assume higher number = higher rank? Or lower? Let's stick to Higher Number = Higher Rank for Discord style)
                # Actually Discord stores position as integer, usually 0 is @everyone (lowest).
                my_roles.sort(key=lambda x: x['position'], reverse=True) 
                highest_role = my_roles[0]
            
            m['roles'] = [r['id'] for r in my_roles] # Return list of role IDs
            m['highest_role'] = {
                "name": highest_role['name'] if highest_role else ("Owner" if m['legacy_role'] == 'owner' else "Member"),
                "color": highest_role['color'] if highest_role else "#99AAB5", # Default Gray
                "position": highest_role['position'] if highest_role else 0
            }
            enriched_members.append(m)
            
        conn.close()
        return {"status": "success", "members": enriched_members}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/server/join")
async def join_server(data: ServerJoin):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Find Server
        c.execute("SELECT id FROM servers WHERE invite_code = ?", (data.invite_code,))
        server = c.fetchone()
        if not server:
            conn.close()
            return {"status": "error", "message": "Davet kodu geçersiz!"}
            
        # 3. Check if already member
        c.execute("SELECT * FROM members WHERE server_id = ? AND user_id = ?", (server['id'], user['id']))
        if c.fetchone():
            conn.close()
            return {"status": "error", "message": "Zaten bu sunucudasın."}
            
        # 4. Add Member
        c.execute("INSERT INTO members (server_id, user_id, role) VALUES (?, ?, ?)",
                 (server['id'], user['id'], 'member'))
        
        conn.commit()
        conn.close()
        return {"status": "success", "server_id": server['id'], "server_name": "Joined"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- Channel Management Endpoints ---
@app.post("/channel/create")
async def create_channel(data: ChannelCreate):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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

@app.post("/channel/rename")
async def rename_channel(data: ChannelRename):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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

# --- ROLE MANAGEMENT MODELS ---
class RoleCreate(BaseModel):
    token: str
    name: str
    color: str
    permissions: int

class RoleUpdate(BaseModel):
    token: str
    name: str
    color: str
    permissions: int
    position: int

class RoleAssign(BaseModel):
    token: str
    user_id: int # The user to assign role to

# --- ROLE MANAGEMENT ENDPOINTS ---

@app.get("/server/{server_id}/roles")
async def get_server_roles(server_id: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM roles WHERE server_id = ? ORDER BY position ASC", (server_id,))
        roles = [dict(row) for row in c.fetchall()]
        conn.close()
        return {"status": "success", "roles": roles}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/server/{server_id}/roles")
async def create_role(server_id: str, data: RoleCreate):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Auth
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}

        # Check Permission (Owner only for MVP)
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server or server['owner_id'] != user['id']:
            conn.close()
            return {"status": "error", "message": "Unauthorized"}
            
        # Get next position (highest position + 1)
        # Note: In Discord, lower number = higher position usually, or vice versa. 
        # Let's say: 0 is lowest (default). We want new roles to be above default but below others? 
        # Or just append to bottom. Let's do: 1 is lowest?
        # Let's just use auto-increment logic or max + 1.
        c.execute("SELECT MAX(position) as max_pos FROM roles WHERE server_id = ?", (server_id,))
        row = c.fetchone()
        new_pos = (row['max_pos'] or 0) + 1
        
        c.execute("INSERT INTO roles (server_id, name, color, position, permissions) VALUES (?, ?, ?, ?, ?)",
                  (server_id, data.name, data.color, new_pos, data.permissions))
        conn.commit()
        
        # Get ID of inserted role
        new_role_id = c.lastrowid
        
        # Return the new role object
        new_role = {
            "id": new_role_id,
            "server_id": server_id,
            "name": data.name,
            "color": data.color,
            "position": new_pos,
            "permissions": data.permissions
        }
        
        conn.close()
        return {"status": "success", "role": new_role}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.put("/server/{server_id}/roles/{role_id}")
async def update_role(server_id: str, role_id: int, data: RoleUpdate):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Auth
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user: return {"status": "error", "message": "Invalid token"}

        # Check Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server or server['owner_id'] != user['id']:
            conn.close()
            return {"status": "error", "message": "Unauthorized"}

        c.execute("UPDATE roles SET name=?, color=?, permissions=?, position=? WHERE id=?", 
                 (data.name, data.color, data.permissions, data.position, role_id))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/server/{server_id}/roles/{role_id}")
async def delete_role(server_id: str, role_id: int, token: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        
        # Auth
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user: return {"status": "error", "message": "Invalid token"}

        # Check Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        # Use row factory or index
        if not server or server[0] != user[0]: # index 0 is owner_id usually check schema
             conn.close()
             return {"status": "error", "message": "Unauthorized"}
             
        c.execute("DELETE FROM roles WHERE id = ?", (role_id,))
        c.execute("DELETE FROM user_roles WHERE role_id = ?", (role_id,))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/server/{server_id}/members/{user_id}/roles")
async def assign_role(server_id: str, user_id: int, data: RoleAssign):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Auth (Requester)
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        req_user = c.fetchone()
        if not req_user: return {"status": "error", "message": "Invalid token"}
        
        # Check Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server or server['owner_id'] != req_user['id']:
            conn.close()
            return {"status": "error", "message": "Unauthorized"}
        
        # Check if role exists
        # We need role_id from input? The endpoint assumes we are posting a specific role, but I used user_id in path.
        # Wait, the model `RoleAssign` handles user_id, but where is role_id? 
        # Better design: POST /.../roles with body { role_id: ... }
        # Or POST /.../roles/{role_id} to assign?
        # Let's adjust: The body should have `role_id`.
        pass 
        # Reserving for retry or fix. Using a simpler generic endpoint below.
    except: pass
    return {"status": "error", "message": "Not implemented"}

@app.post("/server/{server_id}/assign_role")
async def server_assign_role(server_id: str, data: Dict): 
    # data: { token, user_id, role_id }
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Auth
        c.execute("SELECT id FROM users WHERE token = ?", (data.get('token'),))
        req_user = c.fetchone()
        if not req_user: 
             conn.close()
             return {"status": "error", "message": "Invalid token"}

        # Check Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server or server['owner_id'] != req_user['id']:
             conn.close()
             return {"status": "error", "message": "Unauthorized"}

        role_id = data.get('role_id')
        target_user_id = data.get('user_id')
        
        # Assign
        try:
            c.execute("INSERT INTO user_roles (user_id, role_id, server_id) VALUES (?, ?, ?)", 
                     (target_user_id, role_id, server_id))
            conn.commit()
        except sqlite3.IntegrityError:
            pass # Already has role
            
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/server/{server_id}/remove_role")
async def server_remove_role(server_id: str, data: Dict): 
    # data: { token, user_id, role_id }
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Auth
        c.execute("SELECT id FROM users WHERE token = ?", (data.get('token'),))
        req_user = c.fetchone()
        if not req_user: return {"status": "error", "message": "Invalid token"}

        # Check Permission
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server or server['owner_id'] != req_user['id']:
             conn.close()
             return {"status": "error", "message": "Unauthorized"}

        role_id = data.get('role_id')
        target_user_id = data.get('user_id')
        
        c.execute("DELETE FROM user_roles WHERE user_id=? AND role_id=? AND server_id=?", 
                 (target_user_id, role_id, server_id))
        conn.commit()
        conn.close()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}



@app.post("/channel/delete")
async def delete_channel(data: ChannelDelete):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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
        
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (channel['server_id'],))
        server = c.fetchone()
        
        if server['owner_id'] != user['id']:
            conn.close()
            return {"status": "error", "message": "Only server owner can delete channels"}
        
        # 3. Disconnect all users from this voice channel (if voice)
        # Note: Voice room management is handled separately by WebSocket connections
        # This deletion just removes the channel from database
        
        # 4. Delete channel messages
        c.execute("DELETE FROM channel_messages WHERE channel_id = ?", (data.channel_id,))
        
        # 5. Delete channel
        c.execute("DELETE FROM channels WHERE id = ?", (data.channel_id,))
        
        conn.commit()
        conn.close()
        
        log_event("CHANNEL", f"Channel deleted: {data.channel_id}")
        
        # Broadcast lobby update
        await broadcast_lobby_update()
        
        return {"status": "success"}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/channel/{channel_id}/messages")
async def get_channel_messages(channel_id: str, token: str):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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


@app.post("/chat/upload")
async def chat_upload(token: str = Form(...), file: UploadFile = File(...)):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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

@app.post("/message/edit")
async def edit_message(data: dict):
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        new_content = data.get('content')
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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

@app.post("/message/delete")
async def delete_message(data: dict):
    try:
        token = data.get('token')
        message_id = data.get('message_id')
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
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


@app.post("/utils/link-preview")
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

@app.post("/server/{server_id}/leave")
async def leave_server(server_id: str, data: dict):
    try:
        token = data.get('token')
        if not token:
            return {"status": "error", "message": "Token required"}
            
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Check if member of server
        c.execute("SELECT * FROM members WHERE server_id = ? AND user_id = ?", (server_id, user['id']))
        member = c.fetchone()
        if not member:
            conn.close()
            return {"status": "error", "message": "Bu sunucunun üyesi değilsin."}
            
        # 3. Remove member
        c.execute("DELETE FROM members WHERE server_id = ? AND user_id = ?", (server_id, user['id']))
        
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Sunucudan ayrıldın."}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- Friend Endpoints ---

@app.post("/friends/add")
async def add_friend(data: dict):
    try:
        token = data.get('token')
        friend_tag = data.get('friend_tag') # username#1234
        
        if not token or not friend_tag:
            return {"status": "error", "message": "Eksik bilgi"}
            
        parts = friend_tag.split('#')
        if len(parts) != 2:
            return {"status": "error", "message": "Format: username#1234 olmalı"}
            
        f_username, f_disc = parts[0], parts[1]
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate me
        c.execute("SELECT id, username FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Find friend
        c.execute("SELECT id, username, discriminator FROM users WHERE username = ? AND discriminator = ?", (f_username, f_disc))
        friend = c.fetchone()
        
        if not friend:
            conn.close()
            return {"status": "error", "message": "Kullanıcı bulunamadı!"}
            
        if friend['id'] == user['id']:
             conn.close()
             return {"status": "error", "message": "Kendini ekleyemezsin."}
             
        # 3. Check if already friends
        c.execute("SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?", (user['id'], friend['id']))
        if c.fetchone():
             conn.close()
             return {"status": "error", "message": "Zaten arkadaşsınız."}
             
        # 4. Check if request already sent
        c.execute("SELECT 1 FROM friend_requests WHERE sender_id = ? AND receiver_id = ?", (user['id'], friend['id']))
        if c.fetchone():
             conn.close()
             return {"status": "error", "message": "Zaten istek gönderdin."}

        # 5. Send Friend Request (Notify if online)
        c.execute("INSERT INTO friend_requests (sender_id, receiver_id) VALUES (?, ?)", (user['id'], friend['id']))
        conn.commit()
        conn.close()
        
        # Push notification via Lobby
        if friend['username'] in lobby.active_connections:
             try:
                 await lobby.active_connections[friend['username']].send_text(json.dumps({
                     "type": "friend_request",
                     "sender": user['username'],
                     "discriminator": "???", 
                 }))
             except: pass
        
        return {"status": "success", "message": "Arkadaşlık isteği gönderildi."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/friends/requests")
async def get_friend_requests(data: dict):
    try:
        token = data.get('token')
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user: return {"status": "error"}
        
        # Get incoming requests
        c.execute('''
            SELECT u.username, u.discriminator
            FROM friend_requests fr
            JOIN users u ON fr.sender_id = u.id
            WHERE fr.receiver_id = ?
        ''', (user['id'],))
        
        requests = []
        for row in c.fetchall():
            requests.append({"username": row['username'], "discriminator": row['discriminator']})
            
        conn.close()
        return {"status": "success", "requests": requests}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/friends/respond")
async def respond_friend_request(data: dict):
    try:
        token = data.get('token')
        sender_username = data.get('sender_username')
        action = data.get('action') # 'accept' or 'reject'
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        me = c.fetchone()
        c.execute("SELECT id FROM users WHERE username = ?", (sender_username,))
        sender = c.fetchone()
        
        if not me or not sender: return {"status": "error", "message": "Users not found"}
        
        # 1. DELETE REQUEST
        c.execute("DELETE FROM friend_requests WHERE sender_id = ? AND receiver_id = ?", (sender['id'], me['id']))
        
        if action == 'accept':
            # 2. INSERT into friends (Bidirectional)
            c.execute("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)", (me['id'], sender['id']))
            c.execute("INSERT OR IGNORE INTO friends (user_id, friend_id) VALUES (?, ?)", (sender['id'], me['id']))
            msg = "Arkadaşlık kabul edildi."
        else:
            msg = "İstek reddedildi."
            
        conn.commit()
        conn.close()
        return {"status": "success", "message": msg}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/friends/remove")
async def remove_friend(data: dict):
    try:
        token = data.get('token')
        friend_username = data.get('friend_username')
        
        if not token or not friend_username:
            return {"status": "error", "message": "Token and friend_username required"}
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # 2. Find friend
        c.execute("SELECT id FROM users WHERE username = ?", (friend_username,))
        friend = c.fetchone()
        if not friend:
            conn.close()
            return {"status": "error", "message": "Kullanıcı bulunamadı!"}
        
        # 3. Remove friendship (bidirectional)
        c.execute("DELETE FROM friends WHERE user_id = ? AND friend_id = ?", (user['id'], friend['id']))
        c.execute("DELETE FROM friends WHERE user_id = ? AND friend_id = ?", (friend['id'], user['id']))
        
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "Arkadaş kaldırıldı."}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/friends/list")
async def list_friends(data: dict):
    try:
        token = data.get('token')
        if not token:
            return {"status": "error", "message": "Token required"}
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # 2. Get friends
        c.execute('''
            SELECT u.username, u.discriminator, u.display_name 
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ?
            ORDER BY u.username
        ''', (user['id'],))
        
        friends = []
        for row in c.fetchall():
            friends.append({
                "username": row['username'],
                "discriminator": row['discriminator'],
                "display_name": row['display_name']
            })
        
        conn.close()
        return {"status": "success", "friends": friends}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- DM Endpoints ---

@app.post("/dm/send")
async def send_dm(dm: DMSend):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate sender
        c.execute("SELECT id, username FROM users WHERE token = ?", (dm.token,))
        sender = c.fetchone()
        if not sender:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Validate receiver
        c.execute("SELECT id FROM users WHERE username = ?", (dm.receiver_username,))
        receiver = c.fetchone()
        if not receiver:
            conn.close()
            return {"status": "error", "message": "Kullanıcı bulunamadı"}
            
        # 3. Save message
        c.execute("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)", 
                  (sender['id'], receiver['id'], dm.content))
        msg_id = c.lastrowid
        conn.commit()
        conn.close()
        
        # 4. Real-time push via Lobby WebSocket
        # We need to find the receiver in the Lobby connections
        # Since Lobby keys are just user_id (username), we can check directly
        if dm.receiver_username in lobby.active_connections:
            ws = lobby.active_connections[dm.receiver_username]
            try:
                await ws.send_text(json.dumps({
                    "type": "dm_received",
                    "sender": sender['username'],
                    "content": dm.content,
                    "timestamp": datetime.datetime.now().isoformat()
                }))
            except:
                pass
                
        return {"status": "success"}
    except Exception as e:
        print(e)
        return {"status": "error", "message": str(e)}

@app.post("/dm/history")
async def get_dm_history(data: dict):
    try:
        token = data.get('token')
        other_username = data.get('username')
        
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        me = c.fetchone()
        if not me: return {"status": "error"}
        
        c.execute("SELECT id FROM users WHERE username = ?", (other_username,))
        other = c.fetchone()
        if not other: return {"status": "error"}
        
        # Get history
        c.execute('''
            SELECT m.content, m.timestamp, u.username as sender
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) 
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.timestamp ASC
            LIMIT 50
        ''', (me['id'], other['id'], other['id'], me['id']))
        
        messages = []
        for row in c.fetchall():
            messages.append({
                "sender": row['sender'],
                "content": row['content'],
                "timestamp": row['timestamp']
            })
            
        conn.close()
        return {"status": "success", "messages": messages}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/user/profile/update")
async def update_profile(data: dict):
    try:
        token = data.get('token')
        new_display_name = data.get('display_name')
        new_color = data.get('avatar_color')
        
        if not token:
            return {"status": "error", "message": "Token required"}
            
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Update fields
        if new_display_name:
            c.execute("UPDATE users SET display_name = ? WHERE id = ?", (new_display_name, user['id']))
            
        if new_color:
            c.execute("UPDATE users SET avatar_color = ? WHERE id = ?", (new_color, user['id']))
            
        conn.commit()
        
        # 3. Fetch updated user to return
        c.execute("SELECT username, display_name, avatar_color FROM users WHERE id = ?", (user['id'],))
        updated_user = c.fetchone()
        conn.close()
        
        return {
            "status": "success", 
            "user": {
                "username": updated_user['username'],
                "display_name": updated_user['display_name'],
                "avatar_color": updated_user['avatar_color'] or '#5865F2',
                "avatar_url": updated_user['avatar_url']
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/user/profile/avatar")
async def upload_avatar(token: str = Form(...), file: UploadFile = File(...)):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id, username FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Save File
        file_ext = file.filename.split('.')[-1]
        filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
            
        # 3. Update DB
        avatar_url = f"/uploads/{filename}"
        c.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user['id']))
        conn.commit()
        
        c.execute("SELECT avatar_url FROM users WHERE id = ?", (user['id'],))
        updated_user = c.fetchone()
        conn.close()
        
        return {"status": "success", "avatar_url": updated_user['avatar_url']}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/auth/reset")
async def reset_password(data: UserReset):
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM users WHERE username = ?", (data.username,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return {"status": "error", "message": "Kullanıcı bulunamadı."}
            
        # Check PIN
        # Note: PIN is stored as plain text for simplicity per user request (4 digits)
        if user['recovery_pin'] != data.recovery_pin:
            conn.close()
            return {"status": "error", "message": "Kurtarma PIN kodu hatalı!"}
            
        # Update Password
        new_hashed = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hashed, user['id']))
        conn.commit()
        conn.close()
        
        log_event("AUTH", f"Password reset for: {data.username}")
        return {"status": "success", "message": "Şifre başarıyla değiştirildi. Şimdi giriş yapabilirsin."}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.get("/")
async def root():
    log_event("HTTP", "Root endpoint accessed")
    return {"status": "online", "server": "SafeZone-TR-1", "auth_enabled": True}

# --- WebSocket Endpoints ---

@app.websocket("/ws/lobby/{user_id}")
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


async def broadcast(room, message: str):
    for conn in room.active_connections:
        try:
            await conn['ws'].send_text(message)
        except:
            pass # Handle disconnected clients

@app.websocket("/ws/room/{room_id}/{user_id}")
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
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
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
                conn = sqlite3.connect(DB_NAME)
                c = conn.cursor()
                c.execute("SELECT id FROM users WHERE username = ?", (data.get('sender', user_id),))
                user_row = c.fetchone()
                if user_row:
                    c.execute('''INSERT INTO channel_messages 
                                (channel_id, sender_id, content, attachment_url, attachment_type, attachment_name) 
                                VALUES (?, ?, ?, ?, ?, ?)''', 
                              (room_id, user_row[0], data.get('text', ""), 
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
                continue # Don't broadcast this message as raw text
            
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

if __name__ == "__main__":
    # Clear old log
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"--- SERVER STARTED AT {datetime.datetime.now()} ---\n")

    print("============================================")
    print("   SAFEZONE SUNUCUSU BAŞLATILIYOR... 🚀")
    print("   (Loglar server_log.txt dosyasina kaydediliyor)")
    print("============================================")
    # SSL KALDIRILDI - SSH TUNEL ICIN HTTP GEREKLI
    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="warning", reload=True)
