from fastapi import APIRouter, UploadFile, File, Form
from database import get_db_connection
from utils import validate_upload, ALLOWED_IMAGE_EXTS, safe_error
import uuid
import os
import sqlite3
from state import broadcast_room_update

router = APIRouter(prefix="/user", tags=["user"])

# Ensure uploads directory
os.makedirs("uploads", exist_ok=True)

@router.post("/profile/update")
async def update_profile(data: dict):
    try:
        token = data.get('token')
        new_display_name = data.get('display_name')
        new_color = data.get('avatar_color')
        
        if not token:
            return {"status": "error", "message": "Token required"}
            
        conn = get_db_connection()
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
        c.execute("SELECT username, display_name, avatar_color, avatar_url FROM users WHERE id = ?", (user['id'],))
        updated_user = c.fetchone()
        conn.close()
        
        await broadcast_room_update()
        
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
        return safe_error(e)

@router.post("/profile/avatar")
async def upload_avatar(token: str = Form(...), file: UploadFile = File(...)):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Validate Token
        c.execute("SELECT id, username FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
            
        # 2. Read content + validate (size, extension, magic bytes)
        content = await file.read()
        is_valid, err_msg = validate_upload(content, file.filename, ALLOWED_IMAGE_EXTS)
        if not is_valid:
            conn.close()
            return {"status": "error", "message": err_msg}

        # 3. Save File
        ext = file.filename.rsplit('.', 1)[-1].lower()
        filename = f"{user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as f:
            f.write(content)
            
        # 3. Update DB
        avatar_url = f"/uploads/{filename}"
        c.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user['id']))
        conn.commit()
        
        c.execute("SELECT avatar_url FROM users WHERE id = ?", (user['id'],))
        updated_user = c.fetchone()
        conn.close()
        
        return {"status": "success", "avatar_url": updated_user['avatar_url']}
        
    except Exception as e:
        return safe_error(e)

@router.post("/status")
async def update_status(data: dict):
    """Update user online status (online, idle, dnd, offline)."""
    try:
        token = data.get('token')
        new_status = data.get('status', 'online')
        
        if new_status not in ['online', 'idle', 'dnd', 'offline']:
            return {"status": "error", "message": "Invalid status"}
        
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute("UPDATE users SET status = ? WHERE id = ?", (new_status, user['id']))
        conn.commit()
        conn.close()
        
        return {"status": "success", "user_status": new_status}
    except Exception as e:
        return safe_error(e)

@router.get("/profile/{username}")
async def get_user_profile(username: str, token: str):
    """Get a user's public profile."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        if not c.fetchone():
            conn.close()
            return {"status": "error", "message": "Invalid token"}
        
        c.execute("""
            SELECT username, display_name, discriminator, avatar_color, avatar_url, status
            FROM users WHERE username = ?
        """, (username,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "User not found"}
        
        profile = dict(user)
        
        # Get mutual servers
        c.execute("""
            SELECT s.id, s.name, s.icon_url 
            FROM servers s
            JOIN members m1 ON s.id = m1.server_id
            JOIN members m2 ON s.id = m2.server_id
            JOIN users u1 ON m1.user_id = u1.id AND u1.token = ?
            JOIN users u2 ON m2.user_id = u2.id AND u2.username = ?
        """, (token, username))
        profile['mutual_servers'] = [dict(row) for row in c.fetchall()]
        
        conn.close()
        return {"status": "success", "profile": profile}
    except Exception as e:
        return safe_error(e)

@router.post("/avatar")
async def upload_avatar(token: str = Form(...), file: UploadFile = File(...)):
    from utils import validate_upload, ALLOWED_IMAGE_EXTS
    import os
    import time
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id, username FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Geçersiz token"}
            
        validated_file = await validate_upload(file, ALLOWED_IMAGE_EXTS)
        
        upload_dir = "uploads/avatars"
        os.makedirs(upload_dir, exist_ok=True)
        
        ext = validated_file.filename.split('.')[-1]
        filename = f"avatar_{user['id']}_{int(time.time())}.{ext}"
        filepath = os.path.join(upload_dir, filename)
        
        with open(filepath, "wb") as buffer:
            buffer.write(await validated_file.read())
            
        avatar_url = f"/uploads/avatars/{filename}"
        
        c.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (avatar_url, user['id']))
        conn.commit()
        conn.close()
        
        await broadcast_room_update()
        
        return {"status": "success", "avatar_url": avatar_url}
        
    except Exception as e:
        return safe_error(e)

from pydantic import BaseModel
class StatusUpdateParam(BaseModel):
    token: str
    preferred_status: str
    custom_status: str = None

@router.put("/status")
async def update_status(data: StatusUpdateParam):
    try:
        if data.preferred_status not in ['online', 'idle', 'dnd', 'invisible']:
            return {"status": "error", "message": "Geçersiz durum"}
            
        conn = get_db_connection()
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE token = ?", (data.token,))
        user = c.fetchone()
        if not user:
            conn.close()
            return {"status": "error", "message": "Geçersiz token"}
            
        c.execute("UPDATE users SET preferred_status = ?, custom_status = ? WHERE id = ?",
                 (data.preferred_status, data.custom_status, user['id']))
        conn.commit()
        conn.close()
        
        await broadcast_room_update()
        
        return {\"status\": \"success\"}
    except Exception as e:
        return safe_error(e)

# ── User Blocking ──────────────────────────────────────────────────────────────

@router.post("/block")
async def block_user(data: dict):
    """Block a user — they can no longer DM you and you can no longer DM them."""
    try:
        token = data.get('token')
        target_username = data.get('username')
        if not token or not target_username:
            return {"status": "error", "message": "Missing fields"}

        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        me = c.fetchone()
        if not me:
            conn.close()
            return {"status": "error", "message": "Invalid token"}

        c.execute("SELECT id FROM users WHERE username = ?", (target_username,))
        target = c.fetchone()
        if not target:
            conn.close()
            return {"status": "error", "message": "User not found"}

        if me['id'] == target['id']:
            conn.close()
            return {"status": "error", "message": "Cannot block yourself"}

        c.execute(
            "INSERT OR IGNORE INTO block_list (blocker_id, blocked_id) VALUES (?, ?)",
            (me['id'], target['id'])
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"{target_username} engellendi."}
    except Exception as e:
        return safe_error(e)


@router.post("/unblock")
async def unblock_user(data: dict):
    """Remove a block."""
    try:
        token = data.get('token')
        target_username = data.get('username')
        if not token or not target_username:
            return {"status": "error", "message": "Missing fields"}

        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        me = c.fetchone()
        if not me:
            conn.close()
            return {"status": "error", "message": "Invalid token"}

        c.execute("SELECT id FROM users WHERE username = ?", (target_username,))
        target = c.fetchone()
        if not target:
            conn.close()
            return {"status": "error", "message": "User not found"}

        c.execute(
            "DELETE FROM block_list WHERE blocker_id = ? AND blocked_id = ?",
            (me['id'], target['id'])
        )
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"{target_username} engellemesi kaldırıldı."}
    except Exception as e:
        return safe_error(e)


@router.post("/blocked")
async def get_blocked_list(data: dict):
    """Return the list of users the caller has blocked."""
    try:
        token = data.get('token')
        if not token:
            return {"status": "error", "message": "Missing token"}

        conn = get_db_connection()
        c = conn.cursor()

        c.execute("SELECT id FROM users WHERE token = ?", (token,))
        me = c.fetchone()
        if not me:
            conn.close()
            return {"status": "error", "message": "Invalid token"}

        c.execute("""
            SELECT u.username, u.display_name, u.discriminator, u.avatar_url, u.avatar_color
            FROM block_list bl
            JOIN users u ON bl.blocked_id = u.id
            WHERE bl.blocker_id = ?
        """, (me['id'],))
        blocked = [dict(row) for row in c.fetchall()]
        conn.close()
        return {"status": "success", "blocked": blocked}
    except Exception as e:
        return safe_error(e)

