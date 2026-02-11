from fastapi import APIRouter, UploadFile, File, Form
from database import get_db_connection
import uuid
import os
import sqlite3

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
        return {"status": "error", "message": str(e)}

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
        return {"status": "error", "message": str(e)}
