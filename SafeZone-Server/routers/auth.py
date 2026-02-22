from fastapi import APIRouter
from models import UserRegister, UserLogin, UserReset, AdminLogin
from database import get_db_connection
from utils import log_event
from config import ADMIN_SECRET
import bcrypt
import secrets
import sqlite3
import random

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(user: UserRegister):
    try:
        log_event("AUTH", f"Register attempt: {user.username} ({user.email})")
        conn = get_db_connection()
        c = conn.cursor()
        
        # Check if email exists
        c.execute("SELECT id FROM users WHERE email = ?", (user.email,))
        if c.fetchone():
            conn.close()
            return {"status": "error", "message": "Bu E-Posta adresi zaten kayıtlı."}
        
        # Generate discriminator (4-digit number)
        # Find all existing discriminators for this username
        c.execute("SELECT discriminator FROM users WHERE username = ?", (user.username,))
        existing_discriminators = set(row['discriminator'] for row in c.fetchall())
        
        # Generate a unique discriminator (0001-9999)
        discriminator = None
        for attempt in range(100):  # Try 100 times
            candidate = str(random.randint(1, 9999)).zfill(4)
            if candidate not in existing_discriminators:
                discriminator = candidate
                break
        
        if not discriminator:
            conn.close()
            return {"status": "error", "message": "Bu kullanıcı adı çok popüler, başka bir isim deneyin."}
        
        # Hash password & Save
        hashed_pw_bytes = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
        hashed_pw_str = hashed_pw_bytes.decode('utf-8')
        
        # Generate initial token
        token = secrets.token_hex(16)
        
        try:
            c.execute("INSERT INTO users (username, discriminator, email, password_hash, display_name, token, recovery_pin) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (user.username, discriminator, user.email, hashed_pw_str, user.display_name, token, user.recovery_pin))
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return {"status": "error", "message": "Kayıt sırasında hata oluştu (Duplicate)."}
            
        conn.close()
        log_event("AUTH", f"User registered: {user.username}#{discriminator}")
        return {"status": "success", "token": token, "username": user.username, "display_name": user.display_name, "discriminator": discriminator, "email": user.email}
    except Exception as e:
        import traceback
        traceback.print_exc()
        log_event("ERROR", f"Register failed: {str(e)}")
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@router.post("/login")
async def login(user: UserLogin):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Login with Email
        c.execute("SELECT * FROM users WHERE email = ?", (user.email,))
        db_user = c.fetchone()
        
        if not db_user:
            conn.close()
            return {"status": "error", "message": "E-Posta veya şifre hatalı."}
            
        # Verify password
        stored_hash = db_user['password_hash'].encode('utf-8')
        if not bcrypt.checkpw(user.password.encode('utf-8'), stored_hash):
            conn.close()
            return {"status": "error", "message": "E-Posta veya şifre hatalı."}
        
        # Generate new token
        new_token = secrets.token_hex(16)
        c.execute("UPDATE users SET token = ? WHERE id = ?", (new_token, db_user['id']))
        conn.commit()
        conn.close()
        
        return {
            "status": "success", 
            "token": new_token, 
            "username": db_user['username'], 
            "display_name": db_user['display_name'], 
            "discriminator": db_user['discriminator'],
            "email": db_user['email'],
            "is_sysadmin": bool(db_user['is_sysadmin'])
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Login Error: {str(e)}"}

@router.post("/admin-login")
async def admin_login(data: AdminLogin):
    try:
        # Check Master Key
        if data.secret != ADMIN_SECRET:
            return {"status": "error", "message": "Invalid Admin Secret"}
            
        conn = get_db_connection()
        c = conn.cursor()
        
        # Find default ADMIN user (or any sysadmin)
        c.execute("SELECT * FROM users WHERE is_sysadmin = 1 ORDER BY id ASC LIMIT 1")
        admin_user = c.fetchone()
        
        if not admin_user:
            conn.close()
            return {"status": "error", "message": "No SysAdmin found in database."}
            
        # Generate new token
        new_token = secrets.token_hex(16)
        c.execute("UPDATE users SET token = ? WHERE id = ?", (new_token, admin_user['id']))
        conn.commit()
        conn.close()
        
        log_event("AUTH", f"Admin Auto-Login: {admin_user['username']}")
        
        return {
            "status": "success", 
            "token": new_token, 
            "username": admin_user['username'], 
            "display_name": admin_user['display_name'], 
            "discriminator": admin_user['discriminator'],
            "email": admin_user['email'],
            "is_sysadmin": True
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": f"Admin Login Error: {str(e)}"}

@router.post("/verify")
async def verify_token(data: dict):
    try:
        # Simple token check
        token = data.get("token")
        if not token:
            return {"status": "error", "message": "No token"}
            
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT username, display_name, discriminator, email, is_sysadmin, avatar_url, avatar_color, status FROM users WHERE token = ?", (token,))
        user = c.fetchone()
        conn.close()
        
        if user:
            return {
                "status": "success", 
                "username": user['username'], 
                "display_name": user['display_name'], 
                "discriminator": user['discriminator'],
                "email": user['email'],
                "is_sysadmin": bool(user['is_sysadmin']),
                "avatar_url": user['avatar_url'],
                "avatar_color": user['avatar_color'] or '#5865F2',
                "status": user['status'] or 'online'
            }
        else:
            return {"status": "error", "message": "Invalid token"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@router.post("/reset")
async def reset_password(data: UserReset):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Find user by Email
        c.execute("SELECT * FROM users WHERE email = ?", (data.email,))
        user = c.fetchone()
        
        if not user:
            conn.close()
            return {"status": "error", "message": "Kullanıcı bulunamadı."}
            
        # Check PIN
        if user['recovery_pin'] != data.recovery_pin:
            conn.close()
            return {"status": "error", "message": "Kurtarma PIN kodu hatalı!"}
            
        # Update Password
        new_hashed = bcrypt.hashpw(data.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hashed, user['id']))
        conn.commit()
        conn.close()
        
        log_event("AUTH", f"Password reset for: {data.email}")
        return {"status": "success", "message": "Şifre başarıyla değiştirildi. Şimdi giriş yapabilirsin."}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
