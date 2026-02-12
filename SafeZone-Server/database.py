import sqlite3
import os
import secrets
import bcrypt

DB_NAME = "safezone.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    
    # Enable Foreign Keys
    c.execute("PRAGMA foreign_keys = ON")

    # USERS TABLE (v2.0.0)
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL,
                    discriminator TEXT NOT NULL,
                    email TEXT UNIQUE,  -- Made nullable for backward compat if needed, but intended NOT NULL
                    password_hash TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    token TEXT,
                    recovery_pin TEXT,
                    avatar_url TEXT,
                    avatar_color TEXT DEFAULT '#5865F2',
                    status TEXT DEFAULT 'online',
                    is_sysadmin BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(username, discriminator)
                )''')

    # SERVERS TABLE (v2.0.0)
    c.execute('''CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id INTEGER NOT NULL,
                    invite_code TEXT UNIQUE,
                    icon_url TEXT,
                    description TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP  -- Soft Delete
                )''')
    
    # CHANNELS TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS channels (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    category_id TEXT,
                    position INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
                )''')
    
    # MEMBERS TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS members (
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    role TEXT DEFAULT 'member',
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(server_id, user_id),
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )''')
    
    # FRIENDS TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS friends (
                    user_id INTEGER NOT NULL,
                    friend_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(user_id, friend_id),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    # DM MESSAGES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_read BOOLEAN DEFAULT 0,
                    edited_at TIMESTAMP,
                    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    # ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    permissions INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
                )''')

    # USER_ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS user_roles (
                    user_id INTEGER NOT NULL,
                    role_id INTEGER NOT NULL,
                    server_id TEXT NOT NULL,
                    PRIMARY KEY(user_id, role_id, server_id),
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
                )''')

    # FRIEND REQUESTS TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS friend_requests (
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(sender_id, receiver_id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    # BANS TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS bans (
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    banned_by INTEGER,
                    reason TEXT DEFAULT '',
                    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(server_id, user_id),
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )''')
                
    # SERVER CHANNEL MESSAGES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS channel_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    sender_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    attachment_url TEXT,
                    attachment_type TEXT,
                    attachment_name TEXT,
                    edited_at TIMESTAMP,
                    reply_to_id INTEGER,
                    is_pinned BOOLEAN DEFAULT 0,
                    FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE,
                    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
                )''')
    
    # AUDIT LOG (Faz 2)
    c.execute('''CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    # MESSAGE REACTIONS (Faz 3)
    c.execute('''CREATE TABLE IF NOT EXISTS message_reactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    emoji TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(message_id, user_id, emoji),
                    FOREIGN KEY(message_id) REFERENCES channel_messages(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    # CATEGORIES (Faz 4)
    c.execute('''CREATE TABLE IF NOT EXISTS categories (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    position INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
                )''')

    # INVITES (Faz 4)
    c.execute('''CREATE TABLE IF NOT EXISTS invites (
                    code TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    creator_id INTEGER NOT NULL,
                    max_uses INTEGER DEFAULT 0,
                    uses INTEGER DEFAULT 0,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
                    FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE
                )''')

    conn.commit()
    conn.close()

def init_admin():
    """Ensure ADMIN#0001 user exists."""
    conn = get_db_connection()
    c = conn.cursor()
    
    c.execute("SELECT * FROM users WHERE discriminator = '0001' AND is_sysadmin = 1")
    admin = c.fetchone()
    
    if not admin:
        print("Creating Default ADMIN#0001 User...")
        # Create a secure random password (though they will use auto-login key)
        pw = secrets.token_urlsafe(16)
        hashed = bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        try:
            c.execute('''INSERT INTO users 
                        (username, discriminator, email, password_hash, display_name, is_sysadmin, avatar_color) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)''',
                      ('ADMIN', '0001', 'admin@safezone.local', hashed, 'System Admin', 1, '#ED4245'))
            conn.commit()
            print(f"ADMIN Created. Password (if needed): {pw}")
        except sqlite3.IntegrityError:
            print("Admin creation failed (might already exist with different params).")
            
    conn.close()

if __name__ == "__main__":
    init_db()
    init_admin()
    print("Database (v2.0.0) Initialized.")
