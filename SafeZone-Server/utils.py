import datetime
import sqlite3
from database import get_db_connection

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

# --- PERMISSION SYSTEM (Discord-style bitmask) ---

# Permission bit flags
PERM_VIEW_CHANNELS       = 1 << 0   # 1
PERM_MANAGE_CHANNELS     = 1 << 1   # 2
PERM_MANAGE_ROLES        = 1 << 2   # 4
PERM_MANAGE_SERVER       = 1 << 3   # 8
PERM_KICK_MEMBERS        = 1 << 4   # 16
PERM_BAN_MEMBERS         = 1 << 5   # 32
PERM_SEND_MESSAGES       = 1 << 6   # 64
PERM_MANAGE_MESSAGES     = 1 << 7   # 128  (delete others' messages)
PERM_ATTACH_FILES        = 1 << 8   # 256
PERM_MENTION_EVERYONE    = 1 << 9   # 512
PERM_CONNECT_VOICE       = 1 << 10  # 1024
PERM_SPEAK               = 1 << 11  # 2048
PERM_MUTE_MEMBERS        = 1 << 12  # 4096
PERM_DEAFEN_MEMBERS      = 1 << 13  # 8192
PERM_MOVE_MEMBERS        = 1 << 14  # 16384
PERM_ADMINISTRATOR       = 1 << 15  # 32768

# Default permissions for @everyone (new members)
DEFAULT_PERMISSIONS = (
    PERM_VIEW_CHANNELS | PERM_SEND_MESSAGES | PERM_ATTACH_FILES |
    PERM_CONNECT_VOICE | PERM_SPEAK
)

# All permissions combined
ALL_PERMISSIONS = (1 << 16) - 1

def check_permission(user_id: int, server_id: str, permission: int) -> bool:
    """
    Check if a user has a specific permission in a server.
    Owner always has all permissions.
    ADMINISTRATOR permission grants everything.
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. Check if user is server owner (always has all perms)
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server:
            conn.close()
            return False
        if server['owner_id'] == user_id:
            conn.close()
            return True
        
        # 2. Check if user is even a member
        c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (server_id, user_id))
        if not c.fetchone():
            conn.close()
            return False
        
        # 3. Get user's roles in this server
        c.execute("""
            SELECT r.permissions FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.server_id = ? AND ur.user_id = ?
        """, (server_id, user_id))
        
        roles = c.fetchall()
        conn.close()
        
        # 4. Combine all role permissions (OR them together)
        combined = DEFAULT_PERMISSIONS  # Start with default perms
        for role in roles:
            combined |= role['permissions']
        
        # 5. ADMINISTRATOR overrides everything
        if combined & PERM_ADMINISTRATOR:
            return True
        
        # 6. Check specific permission
        return bool(combined & permission)
        
    except Exception as e:
        print(f"Permission check error: {e}")
        return False

def get_user_by_token(token: str):
    """Helper to validate token and return user row."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE token = ?", (token,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None

def create_audit_log(server_id: str, user_id: int, action: str, 
                     target_type: str = None, target_id: str = None, details: str = None):
    """
    Record an action in the audit log.
    
    Actions: KICK, BAN, UNBAN, ROLE_CREATE, ROLE_UPDATE, ROLE_DELETE,
             ROLE_ASSIGN, ROLE_UNASSIGN, CHANNEL_CREATE, CHANNEL_RENAME, 
             CHANNEL_DELETE, MESSAGE_DELETE, MESSAGE_PIN, MESSAGE_UNPIN
    
    Target types: USER, ROLE, CHANNEL, MESSAGE
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("""INSERT INTO audit_log (server_id, user_id, action, target_type, target_id, details) 
                     VALUES (?, ?, ?, ?, ?, ?)""",
                  (server_id, user_id, action, target_type, target_id, details))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Audit log error: {e}")
