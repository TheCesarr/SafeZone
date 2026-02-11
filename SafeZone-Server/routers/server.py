from fastapi import APIRouter, UploadFile, File, Form
from models import ServerCreate, ServerJoin, RoleCreate
from database import get_db_connection
from utils import log_event, check_permission, create_audit_log, PERM_MANAGE_ROLES, PERM_KICK_MEMBERS, PERM_BAN_MEMBERS, PERM_MANAGE_CHANNELS, PERM_MANAGE_SERVER
import uuid
import secrets
import sqlite3
import os
import datetime

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
            
        # 3. Check if banned
        c.execute("SELECT 1 FROM bans WHERE server_id = ? AND user_id = ?", (server['id'], user['id']))
        if c.fetchone():
            conn.close()
            return {"status": "error", "message": "Bu sunucudan yasaklandınız!"}
        
        # 4. Check if already member
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

        # Check Permission (MANAGE_ROLES)
        if not check_permission(user['id'], server_id, PERM_MANAGE_ROLES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Rolleri Yönet)"}
            
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

# --- ROLE MANAGEMENT ENDPOINTS ---

@router.post("/{server_id}/roles/{role_id}/assign")
async def assign_role(server_id: str, role_id: int, data: dict):
    """Assign a role to a user."""
    try:
        token = data.get('token')
        target_user_id = data.get('user_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # Permission check: MANAGE_ROLES
        if not check_permission(user['id'], server_id, PERM_MANAGE_ROLES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Rolleri Yönet)"}
        
        # Verify role exists in this server
        c.execute("SELECT id FROM roles WHERE id = ? AND server_id = ?", (role_id, server_id))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Rol bulunamadı"}
        
        # Verify target user is a member
        c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (server_id, target_user_id))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Kullanıcı bu sunucuda değil"}
        
        # Assign
        c.execute("INSERT OR IGNORE INTO user_roles (user_id, role_id, server_id) VALUES (?, ?, ?)",
                  (target_user_id, role_id, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "Rol atandı."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/{server_id}/roles/{role_id}/unassign")
async def unassign_role(server_id: str, role_id: int, data: dict):
    """Remove a role from a user."""
    try:
        token = data.get('token')
        target_user_id = data.get('user_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_ROLES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Rolleri Yönet)"}
        
        c.execute("DELETE FROM user_roles WHERE user_id = ? AND role_id = ? AND server_id = ?",
                  (target_user_id, role_id, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "Rol kaldırıldı."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.put("/{server_id}/roles/{role_id}")
async def update_role(server_id: str, role_id: int, data: dict):
    """Update a role's name, color, position, or permissions."""
    try:
        token = data.get('token')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_ROLES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Rolleri Yönet)"}
        
        # Verify role exists
        c.execute("SELECT * FROM roles WHERE id = ? AND server_id = ?", (role_id, server_id))
        role = c.fetchone()
        if not role:
            conn.close()
            return {"status": "error", "message": "Rol bulunamadı"}
        
        # Update fields
        new_name = data.get('name', role['name'])
        new_color = data.get('color', role['color'])
        new_position = data.get('position', role['position'])
        new_permissions = data.get('permissions', role['permissions'])
        
        c.execute("UPDATE roles SET name = ?, color = ?, position = ?, permissions = ? WHERE id = ? AND server_id = ?",
                  (new_name, new_color, new_position, new_permissions, role_id, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success", "role": {
            "id": role_id, "name": new_name, "color": new_color,
            "position": new_position, "permissions": new_permissions
        }}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.delete("/{server_id}/roles/{role_id}")
async def delete_role(server_id: str, role_id: int, data: dict):
    """Delete a role from the server."""
    try:
        token = data.get('token')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_ROLES):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Rolleri Yönet)"}
        
        # Remove all user assignments for this role
        c.execute("DELETE FROM user_roles WHERE role_id = ? AND server_id = ?", (role_id, server_id))
        # Delete the role
        c.execute("DELETE FROM roles WHERE id = ? AND server_id = ?", (role_id, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "Rol silindi."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- MODERATION ENDPOINTS ---

@router.post("/{server_id}/kick")
async def kick_member(server_id: str, data: dict):
    """Kick a member from the server."""
    try:
        token = data.get('token')
        target_user_id = data.get('user_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_KICK_MEMBERS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Üyeleri At)"}
        
        # Cannot kick the owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        srv = c.fetchone()
        if srv and srv['owner_id'] == target_user_id:
            conn.close()
            return {"status": "error", "message": "Sunucu sahibi atılamaz!"}
        
        # Remove member
        c.execute("DELETE FROM user_roles WHERE user_id = ? AND server_id = ?", (target_user_id, server_id))
        c.execute("DELETE FROM members WHERE server_id = ? AND user_id = ?", (server_id, target_user_id))
        conn.commit()
        conn.close()
        
        log_event("MOD", f"User {target_user_id} kicked from {server_id} by {user['id']}")
        create_audit_log(server_id, user['id'], "KICK", "USER", str(target_user_id), "Member kicked")
        return {"status": "success", "message": "Kullanıcı sunucudan atıldı."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/{server_id}/ban")
async def ban_member(server_id: str, data: dict):
    """Ban a member from the server."""
    try:
        token = data.get('token')
        target_user_id = data.get('user_id')
        reason = data.get('reason', '')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_BAN_MEMBERS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Üyeleri Yasakla)"}
        
        # Cannot ban the owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        srv = c.fetchone()
        if srv and srv['owner_id'] == target_user_id:
            conn.close()
            return {"status": "error", "message": "Sunucu sahibi yasaklanamaz!"}
        
        # Add to bans
        c.execute("INSERT OR IGNORE INTO bans (server_id, user_id, banned_by, reason) VALUES (?, ?, ?, ?)",
                  (server_id, target_user_id, user['id'], reason))
        
        # Remove from server
        c.execute("DELETE FROM user_roles WHERE user_id = ? AND server_id = ?", (target_user_id, server_id))
        c.execute("DELETE FROM members WHERE server_id = ? AND user_id = ?", (server_id, target_user_id))
        conn.commit()
        conn.close()
        
        log_event("MOD", f"User {target_user_id} banned from {server_id} by {user['id']} (reason: {reason})")
        create_audit_log(server_id, user['id'], "BAN", "USER", str(target_user_id), reason or "No reason")
        return {"status": "success", "message": "Kullanıcı yasaklandı."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/{server_id}/unban")
async def unban_member(server_id: str, data: dict):
    """Unban a user from the server."""
    try:
        token = data.get('token')
        target_user_id = data.get('user_id')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_BAN_MEMBERS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("DELETE FROM bans WHERE server_id = ? AND user_id = ?", (server_id, target_user_id))
        conn.commit()
        conn.close()
        
        create_audit_log(server_id, user['id'], "UNBAN", "USER", str(target_user_id))
        return {"status": "success", "message": "Yasak kaldırıldı."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/{server_id}/bans")
async def get_bans(server_id: str, token: str):
    """List all banned users."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_BAN_MEMBERS):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("""
            SELECT b.user_id, b.reason, b.banned_at, u.username, u.display_name
            FROM bans b
            JOIN users u ON b.user_id = u.id
            WHERE b.server_id = ?
        """, (server_id,))
        
        bans = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "bans": bans}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- AUDIT LOG ---

@router.get("/{server_id}/audit-log")
async def get_audit_log(server_id: str, token: str, limit: int = 50):
    """Get the audit log for a server."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # Only server owner or users with MANAGE_SERVER can view audit log
        if not check_permission(user['id'], server_id, PERM_MANAGE_SERVER):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("""
            SELECT al.id, al.action, al.target_type, al.target_id, al.details, al.created_at,
                   u.username, u.display_name
            FROM audit_log al
            JOIN users u ON al.user_id = u.id
            WHERE al.server_id = ?
            ORDER BY al.created_at DESC
            LIMIT ?
        """, (server_id, min(limit, 100)))
        
        logs = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "logs": logs}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- FAZ 4: SERVER SETTINGS ---

@router.post("/{server_id}/settings")
async def update_server_settings(server_id: str, data: dict):
    """Update server name, description."""
    try:
        token = data.get('token')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_SERVER):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok! (Sunucu Yönet)"}
        
        # Get current values
        c.execute("SELECT name, description FROM servers WHERE id = ?", (server_id,))
        srv = c.fetchone()
        if not srv:
            conn.close()
            return {"status": "error", "message": "Server not found"}
        
        new_name = data.get('name', srv['name'])
        new_desc = data.get('description', srv['description'] or '')
        
        c.execute("UPDATE servers SET name = ?, description = ? WHERE id = ?",
                  (new_name, new_desc, server_id))
        conn.commit()
        conn.close()
        
        create_audit_log(server_id, user['id'], "SERVER_UPDATE", "SERVER", server_id, 
                        f"name={new_name}")
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/{server_id}/icon")
async def upload_server_icon(server_id: str, token: str = Form(...), file: UploadFile = File(...)):
    """Upload server icon."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_SERVER):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        # Save file
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
        filename = f"server_{server_id[:8]}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
        
        icon_url = f"/uploads/{filename}"
        c.execute("UPDATE servers SET icon_url = ? WHERE id = ?", (icon_url, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success", "icon_url": icon_url}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- FAZ 4: INVITE SYSTEM ---

@router.post("/{server_id}/invites")
async def create_invite(server_id: str, data: dict):
    """Create a new invite link."""
    try:
        token = data.get('token')
        max_uses = data.get('max_uses', 0)  # 0 = unlimited
        expires_hours = data.get('expires_hours', 0)  # 0 = never
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        # Any member can create invites (basic permission)
        c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (server_id, user['id']))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Bu sunucuda değilsiniz"}
        
        code = secrets.token_hex(4).upper()
        expires_at = None
        if expires_hours > 0:
            expires_at = (datetime.datetime.now() + datetime.timedelta(hours=expires_hours)).isoformat()
        
        c.execute("INSERT INTO invites (code, server_id, creator_id, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)",
                  (code, server_id, user['id'], max_uses, expires_at))
        conn.commit()
        conn.close()
        
        return {"status": "success", "code": code, "max_uses": max_uses, "expires_at": expires_at}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/{server_id}/invites")
async def list_invites(server_id: str, token: str):
    """List all active invites for a server."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_SERVER):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("""
            SELECT i.code, i.max_uses, i.uses, i.expires_at, i.created_at, u.username as creator
            FROM invites i
            JOIN users u ON i.creator_id = u.id
            WHERE i.server_id = ?
            ORDER BY i.created_at DESC
        """, (server_id,))
        
        invites = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "invites": invites}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.delete("/{server_id}/invites/{code}")
async def delete_invite(server_id: str, code: str, data: dict):
    """Delete/revoke an invite."""
    try:
        token = data.get('token')
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        if not check_permission(user['id'], server_id, PERM_MANAGE_SERVER):
            conn.close()
            return {"status": "error", "message": "Yetkiniz yok!"}
        
        c.execute("DELETE FROM invites WHERE code = ? AND server_id = ?", (code, server_id))
        conn.commit()
        conn.close()
        
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- CATEGORIES LIST ---

@router.get("/{server_id}/categories")
async def get_categories(server_id: str, token: str):
    """Get all categories for a server."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute("SELECT * FROM categories WHERE server_id = ? ORDER BY position ASC", (server_id,))
        categories = [dict(row) for row in c.fetchall()]
        conn.close()
        
        return {"status": "success", "categories": categories}
    except Exception as e:
        return {"status": "error", "message": str(e)}
