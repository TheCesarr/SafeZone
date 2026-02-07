from fastapi import APIRouter
from models import ServerCreate, ServerJoin, RoleCreate
from database import get_db_connection
from utils import log_event
import uuid
import secrets
import sqlite3

router = APIRouter(prefix="/server", tags=["server"])

@router.post("/create")
async def create_server(data: ServerCreate):
    try:
        conn = get_db_connection()
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

@router.get("/list")
async def list_user_servers(token: str):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Get User ID
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # Get Servers user is a member of
        c.execute('''
            SELECT s.id, s.name, s.invite_code, s.owner_id 
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
        return {"status": "success", "servers": servers}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/join")
async def join_server(data: ServerJoin):
    try:
        conn = get_db_connection()
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

# --- MEMBER & ROLE MANAGEMENT ---

@router.get("/{server_id}/members")
async def get_server_members(server_id: str, token: str):
    try:
        conn = get_db_connection()
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

@router.get("/{server_id}/roles")
async def get_server_roles(server_id: str):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT * FROM roles WHERE server_id = ? ORDER BY position ASC", (server_id,))
        roles = [dict(row) for row in c.fetchall()]
        conn.close()
        return {"status": "success", "roles": roles}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/{server_id}/roles")
async def create_role(server_id: str, data: RoleCreate):
    try:
        conn = get_db_connection()
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

@router.post("/leave")
async def leave_server(data: dict):
    # expect token, server_id
    token = data.get('token')
    server_id = data.get('server_id')
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close() 
            return {"status":"error", "message":"Invalid token"}
            
        # Check if owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        srv = c.fetchone()
        
        if srv and srv['owner_id'] == user['id']:
             # Owner is leaving. Check if there are other members.
             c.execute("SELECT user_id FROM members WHERE server_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1", (server_id, user['id']))
             next_owner = c.fetchone()
             
             if next_owner:
                 # Transfer ownership
                 new_owner_id = next_owner['user_id']
                 c.execute("UPDATE servers SET owner_id = ? WHERE id = ?", (new_owner_id, server_id))
                 c.execute("UPDATE members SET role = 'owner' WHERE server_id = ? AND user_id = ?", (server_id, new_owner_id))
                 
                 # Log event
                 log_event("SERVER", f"Ownership transferred from {user['id']} to {new_owner_id} for server {server_id}")
             else:
                 # No other members, DELETE server
                 c.execute("DELETE FROM channel_messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)", (server_id,))
                 c.execute("DELETE FROM channels WHERE server_id = ?", (server_id,))
                 c.execute("DELETE FROM user_roles WHERE server_id = ?", (server_id,))
                 c.execute("DELETE FROM roles WHERE server_id = ?", (server_id,))
                 c.execute("DELETE FROM members WHERE server_id = ?", (server_id,))
                 c.execute("DELETE FROM servers WHERE id = ?", (server_id,))
                 
                 conn.commit()
                 conn.close()
                 return {"status":"success", "message": "Server deleted (no other members)."}

        # Delete the user from members (applies to both regular members and old owner who transferred)
        c.execute("DELETE FROM members WHERE server_id = ? AND user_id = ?", (server_id, user['id']))
        conn.commit()
        conn.close()
        return {"status":"success"}
    except Exception as e:
        return {"status":"error", "message":str(e)}

@router.post("/delete")
async def delete_server(data: dict):
    token = data.get('token')
    server_id = data.get('server_id')
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close(); return {"status":"error", "message":"Invalid token"}
            
        # Check owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        srv = c.fetchone()
        if not srv or srv['owner_id'] != user['id']:
            conn.close(); return {"status":"error", "message":"Yetkisiz işlem"}
            
        # Cascade delete (Manual for now as FKs might not cascade automatically depending on sqlite config)
        c.execute("DELETE FROM channel_messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)", (server_id,))
        c.execute("DELETE FROM channels WHERE server_id = ?", (server_id,))
        c.execute("DELETE FROM user_roles WHERE server_id = ?", (server_id,))
        c.execute("DELETE FROM roles WHERE server_id = ?", (server_id,))
        c.execute("DELETE FROM members WHERE server_id = ?", (server_id,))
        c.execute("DELETE FROM servers WHERE id = ?", (server_id,))
        
        conn.commit()
        conn.close()
        return {"status":"success"}
    except Exception as e:
        return {"status":"error", "message":str(e)}
