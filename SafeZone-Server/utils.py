import sys
import datetime
import sqlite3
import time as _time
from database import get_db_connection
from loguru import logger

# ── Loguru Configuration ──────────────────────────────────────────────────────
logger.remove()   # Remove default stderr handler

# Terminal: colorized, DEBUG and above
logger.add(
    sys.stdout,
    level="DEBUG",
    colorize=True,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}"
)

# File: INFO and above, rotate at 10 MB, keep 7 days, compress old files
logger.add(
    "server_log.txt",
    level="INFO",
    rotation="10 MB",
    retention="7 days",
    compression="zip",
    encoding="utf-8",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} - {message}"
)

LOG_FILE = "server_log.txt"   # kept for any code that imports this name


# --- FILE UPLOAD SECURITY ---
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

# Magic bytes for allowed file types.
# Key = canonical file type, Value = list of (offset, bytes) tuples that must match
ALLOWED_MAGIC = {
    'jpg':  [(0, b'\xff\xd8\xff')],
    'jpeg': [(0, b'\xff\xd8\xff')],
    'png':  [(0, b'\x89PNG')],
    'gif':  [(0, b'GIF87a'), (0, b'GIF89a')],
    'webp': [(0, b'RIFF'), (8, b'WEBP')],
    'mp4':  [(4, b'ftyp')],
    'webm': [(0, b'\x1a\x45\xdf\xa3')],
    'mov':  [(4, b'ftyp'), (4, b'moov')],
    'pdf':  [(0, b'%PDF')],
}

# Extension groups allowed per context
ALLOWED_IMAGE_EXTS  = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
ALLOWED_CHAT_EXTS   = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'pdf'}

def validate_upload(content: bytes, filename: str, allowed_exts: set) -> tuple[bool, str]:
    """
    Validates an uploaded file by:
    1. Checking file size (<= MAX_UPLOAD_SIZE)
    2. Checking the extension is in the allowed set
    3. Reading magic bytes to verify file content matches declared type.

    Returns (is_valid: bool, error_message: str | None)
    """
    # 1. Size check
    if len(content) > MAX_UPLOAD_SIZE:
        max_mb = MAX_UPLOAD_SIZE // (1024 * 1024)
        return False, f"Dosya çok büyük! Maksimum {max_mb}MB yüklenebilir."

    # 2. Extension check
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext not in allowed_exts:
        return False, f"Bu dosya türüne izin verilmiyor. İzin verilenler: {', '.join(sorted(allowed_exts))}"

    # 3. Magic byte check
    header = content[:16]
    magic_rules = ALLOWED_MAGIC.get(ext)
    if magic_rules:
        matched = any(
            header[offset:offset + len(magic)] == magic
            for offset, magic in magic_rules
        )
        if not matched:
            return False, "Dosya içeriği uzantısıyla eşleşmiyor. Lütfen gerçek bir dosya yükleyin."

    return True, None


# --- ERROR HANDLING (Information Disclosure Prevention) ---

def safe_error(e: Exception, context: str = "") -> dict:
    """
    Logs the real exception internally and returns a generic,
    non-revealing error response to the client.
    Use this in every except block instead of returning str(e).
    """
    log_event("ERROR", f"Internal error [{context}]: {type(e).__name__}: {str(e)}")
    return {"status": "error", "message": "İşlem sırasında bir hata oluştu."}


# --- RATE LIMITING (Brute Force Prevention) ---
# In-memory store: {action_key: [timestamp, timestamp, ...]}
_rate_store: dict[str, list[float]] = {}

def rate_limit_check(identifier: str, action: str, max_attempts: int = 10, window_seconds: int = 60) -> tuple[bool, str | None]:
    """
    Checks if `identifier` (e.g. an IP or email) has exceeded `max_attempts`
    for `action` in the last `window_seconds`.

    Returns (is_allowed: bool, error_message: str | None)
    
    Usage:
        allowed, err = rate_limit_check(client_ip, "login", max_attempts=5, window_seconds=60)
        if not allowed:
            return {"status": "error", "message": err}
    """
    key = f"{action}:{identifier}"
    now = _time.monotonic()
    window_start = now - window_seconds

    # Clean up old timestamps
    timestamps = _rate_store.get(key, [])
    timestamps = [t for t in timestamps if t > window_start]

    if len(timestamps) >= max_attempts:
        wait = int(window_seconds - (now - timestamps[0]))
        return False, f"Çok fazla deneme. Lütfen {wait} saniye bekleyin."

    timestamps.append(now)
    _rate_store[key] = timestamps
    return True, None


# ── Backward-compat shim for existing log_event() callers ────────────────────
_LEVEL_MAP = {
    "ERROR":      "error",
    "CONNECT":    "info",
    "DISCONNECT": "info",
    "HTTP":       "info",
    "WS":         "info",
    "AUTH":       "info",
    "WARNING":    "warning",
}

def log_event(event_type: str, message: str):
    level = _LEVEL_MAP.get(event_type.upper(), "info")
    getattr(logger, level)(f"[{event_type}] {message}")

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

        # 0. Check if user is SysAdmin (Global Override)
        c.execute("SELECT is_sysadmin FROM users WHERE id = ?", (user_id,))
        user_row = c.fetchone()
        if user_row and user_row['is_sysadmin']:
            conn.close()
            return True
        
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
        
    except Exception:
        logger.exception("check_permission error")
        return False

def get_user_permissions(user_id: int, server_id: str) -> int:
    """
    Returns the combined permission integer for a user in a server.
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()

        # 0. Check if user is SysAdmin
        c.execute("SELECT is_sysadmin FROM users WHERE id = ?", (user_id,))
        user_row = c.fetchone()
        if user_row and user_row['is_sysadmin']:
            conn.close()
            return ALL_PERMISSIONS
        
        # 1. Check if user is server owner
        c.execute("SELECT owner_id FROM servers WHERE id = ?", (server_id,))
        server = c.fetchone()
        if not server:
            conn.close()
            return 0
        if server['owner_id'] == user_id:
            conn.close()
            return ALL_PERMISSIONS
        
        # 2. Check membership
        c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (server_id, user_id))
        if not c.fetchone():
            conn.close()
            return 0
        
        # 3. Get role permissions
        c.execute("""
            SELECT r.permissions FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.server_id = ? AND ur.user_id = ?
        """, (server_id, user_id))
        
        roles = c.fetchall()
        conn.close()
        
        combined = DEFAULT_PERMISSIONS
        for role in roles:
            combined |= role['permissions']
        
        if combined & PERM_ADMINISTRATOR:
            return ALL_PERMISSIONS
            
        return combined
        
    except Exception:
        logger.exception("get_user_permissions error")
        return 0

def get_user_by_token(token: str):
    """Helper to validate token and return user row."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE token = ?", (token,))
    user = c.fetchone()
    conn.close()
    return dict(user) if user else None

def check_server_membership(user_id: int, server_id: str) -> bool:
    """
    Returns True if the user is a member of the given server, or is a SysAdmin.
    Use this to guard any endpoint that reads server-specific data.
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        # SysAdmins have global access
        c.execute("SELECT is_sysadmin FROM users WHERE id = ?", (user_id,))
        row = c.fetchone()
        if row and row['is_sysadmin']:
            conn.close()
            return True
        # Check membership
        c.execute("SELECT 1 FROM members WHERE server_id = ? AND user_id = ?", (server_id, user_id))
        result = c.fetchone()
        conn.close()
        return result is not None
    except Exception:
        logger.exception("check_server_membership error")
        return False

def check_channel_membership(user_id: int, channel_id: str) -> bool:
    """
    Returns True if the user is a member of the server that owns the given channel.
    Use this to guard any channel-specific data endpoint.
    """
    try:
        conn = get_db_connection()
        c = conn.cursor()
        # Get the server_id this channel belongs to
        c.execute("SELECT server_id FROM channels WHERE id = ?", (channel_id,))
        channel = c.fetchone()
        conn.close()
        if not channel:
            return False
        return check_server_membership(user_id, channel['server_id'])
    except Exception:
        logger.exception("check_channel_membership error")
        return False

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
    except Exception:
        logger.exception("create_audit_log error")
