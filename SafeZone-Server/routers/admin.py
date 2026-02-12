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
