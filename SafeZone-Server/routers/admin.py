from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from database import get_db_connection
from utils import get_user_by_token
import datetime

router = APIRouter(prefix="/admin", tags=["admin"])

def get_current_sysadmin(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Token")
    token = authorization.replace("Bearer ", "")
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid Token")
    if not user.get('is_sysadmin'):
         raise HTTPException(status_code=403, detail="Not a SysAdmin")
    return user

@router.get("/stats")
def get_stats(admin = Depends(get_current_sysadmin)):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM users")
    user_count = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM servers WHERE deleted_at IS NULL")
    active_servers = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM servers")
    total_servers = c.fetchone()[0]
    
    conn.close()
    return {"users": user_count, "servers": active_servers, "total_servers": total_servers}

@router.get("/users")
def get_users(admin = Depends(get_current_sysadmin)):
    conn = get_db_connection()
    conn.row_factory = lambda c, r: dict(zip([col[0] for col in c.description], r))
    c = conn.cursor()
    # Note: created_at might not exist in users table based on current schema
    c.execute("SELECT id, username, display_name, email, is_sysadmin FROM users")
    users = c.fetchall()
    conn.close()
    return users

@router.get("/servers")
def get_servers(admin = Depends(get_current_sysadmin)):
    conn = get_db_connection()
    conn.row_factory = lambda c, r: dict(zip([col[0] for col in c.description], r))
    c = conn.cursor()
    # Join with owner info
    c.execute("""
        SELECT s.id, s.name, s.owner_id, s.created_at, s.deleted_at, u.username as owner_name 
        FROM servers s
        JOIN users u ON s.owner_id = u.id
    """)
    servers = c.fetchall()
    conn.close()
    return servers

class ServerJoinRequest(BaseModel):
    server_id: str

@router.post("/join-server")
def join_server(request: ServerJoinRequest, admin = Depends(get_current_sysadmin)):
    conn = get_db_connection()
    c = conn.cursor()
    
    # Check if server exists
    c.execute("SELECT id FROM servers WHERE id = ?", (request.server_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Server not found")
        
    # Check if already member
    c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (request.server_id, admin['id']))
    if c.fetchone():
        conn.close()
        return {"status": "success", "message": "Already a member"}
        
    # Add to members
    c.execute("INSERT INTO members (server_id, user_id) VALUES (?, ?)", (request.server_id, admin['id']))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Joined server"}

@router.delete("/server/{server_id}")
def delete_server(server_id: str, admin = Depends(get_current_sysadmin)):
    conn = get_db_connection()
    c = conn.cursor()
    
    # Check if currently deleted
    c.execute("SELECT deleted_at FROM servers WHERE id = ?", (server_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Server not found")
    
    if row[0]: # Already deleted, restore? Or permanent delete?
        # Toggle: restore
        c.execute("UPDATE servers SET deleted_at = NULL WHERE id = ?", (server_id,))
        msg = "Server restored"
    else:
        # Soft delete
        c.execute("UPDATE servers SET deleted_at = ? WHERE id = ?", (datetime.datetime.now(), server_id))
        msg = "Server soft-deleted"

    conn.commit()
    conn.close()
    return {"status": "success", "message": msg}

# --- UPDATE ENDPOINTS ---
import bcrypt
from models import AdminUserUpdate, AdminServerUpdate

@router.put("/user/{user_id}")
def update_user(user_id: int, data: AdminUserUpdate, admin = Depends(get_current_sysadmin)):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Check if user exists
        c.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not c.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        # Build Query
        fields = []
        values = []
        
        if data.username is not None:
            fields.append("username = ?")
            values.append(data.username)
        if data.display_name is not None:
            fields.append("display_name = ?")
            values.append(data.display_name)
        if data.email is not None:
            fields.append("email = ?")
            values.append(data.email)
        if data.is_sysadmin is not None:
            # Prevent removing own admin status if you are the only one? maybe too complex for now.
            fields.append("is_sysadmin = ?")
            values.append(1 if data.is_sysadmin else 0)
        if data.password is not None and len(data.password) > 0:
            fields.append("password_hash = ?")
            hashed = bcrypt.hashpw(data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            values.append(hashed)
            
        if not fields:
            conn.close()
            return {"status": "success", "message": "No changes"}
            
        values.append(user_id)
        query = f"UPDATE users SET {', '.join(fields)} WHERE id = ?"
        
        c.execute(query, tuple(values))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "User updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.put("/server/{server_id}")
def update_server(server_id: str, data: AdminServerUpdate, admin = Depends(get_current_sysadmin)):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Check server
        c.execute("SELECT id FROM servers WHERE id = ?", (server_id,))
        if not c.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Server not found")
            
        fields = []
        values = []
        
        if data.name is not None:
            fields.append("name = ?")
            values.append(data.name)
        
        if data.owner_id is not None:
            # Check if new owner exists
            c.execute("SELECT id FROM users WHERE id = ?", (data.owner_id,))
            if not c.fetchone():
                conn.close()
                return {"status": "error", "message": "New owner user ID not found"}
            
            fields.append("owner_id = ?")
            values.append(data.owner_id)
            
            # Also make them owner in members table
            c.execute("UPDATE members SET role = 'owner' WHERE server_id = ? AND user_id = ?", (server_id, data.owner_id))
            # Insert if not exists?
            c.execute("INSERT OR IGNORE INTO members (server_id, user_id, role) VALUES (?, ?, 'owner')", (server_id, data.owner_id))

        if not fields:
            conn.close()
            return {"status": "success", "message": "No changes"}
            
        values.append(server_id)
        query = f"UPDATE servers SET {', '.join(fields)} WHERE id = ?"
        
        c.execute(query, tuple(values))
        conn.commit()
        conn.close()
        
        return {"status": "success", "message": "Server updated"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

