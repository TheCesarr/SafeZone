import sqlite3
import os

DB_NAME = "safezone.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    token TEXT,
                    recovery_pin TEXT
                )''')
    
    # Migration: Add recovery_pin if missing (for existing dbs)
    try:
        c.execute("ALTER TABLE users ADD COLUMN recovery_pin TEXT")
    except:
        pass # Column already exists
    
    # Add discriminator column (Discord-style #1234 tag)
    try:
        c.execute("ALTER TABLE users ADD COLUMN discriminator TEXT DEFAULT '0001'")
    except:
        pass # Column already exists

    # Add avatar_color column
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#5865F2'")
    except:
        pass # Column already exists

    # Add avatar_url column
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
    except:
        pass # Column already exists
        
    # Add status column
    try:
        c.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'online'")
    except:
        pass # Column already exists
        
    # Servers
    c.execute('''CREATE TABLE IF NOT EXISTS servers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner_id INTEGER NOT NULL,
                    invite_code TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )''')
    
    # Channels
    c.execute('''CREATE TABLE IF NOT EXISTS channels (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')
    
    # Members
    c.execute('''CREATE TABLE IF NOT EXISTS members (
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    role TEXT DEFAULT 'member',
                    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(server_id, user_id),
                    FOREIGN KEY(server_id) REFERENCES servers(id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
    
    # Migration: Add joined_at if missing
    try:
        c.execute("ALTER TABLE members ADD COLUMN joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    except:
        pass
    
    # Friends table
    c.execute('''CREATE TABLE IF NOT EXISTS friends (
                    user_id INTEGER NOT NULL,
                    friend_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(user_id, friend_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(friend_id) REFERENCES users(id)
                )''')

    # DM Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_read BOOLEAN DEFAULT 0,
                    FOREIGN KEY(sender_id) REFERENCES users(id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id)
                )''')

    # Migration: Add edited_at to DM messages
    try:
        c.execute("ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP")
    except: pass

    # ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS roles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    position INTEGER NOT NULL,
                    permissions INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')

    # USER_ROLES TABLE
    c.execute('''CREATE TABLE IF NOT EXISTS user_roles (
                    user_id INTEGER NOT NULL,
                    role_id INTEGER NOT NULL,
                    server_id TEXT NOT NULL,
                    PRIMARY KEY(user_id, role_id, server_id),
                    FOREIGN KEY(user_id) REFERENCES users(id),
                    FOREIGN KEY(role_id) REFERENCES roles(id),
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')

    # Friend Requests table
    c.execute('''CREATE TABLE IF NOT EXISTS friend_requests (
                    sender_id INTEGER NOT NULL,
                    receiver_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(sender_id, receiver_id),
                    FOREIGN KEY(receiver_id) REFERENCES users(id)
                )''')

    # Bans table
    c.execute('''CREATE TABLE IF NOT EXISTS bans (
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    banned_by INTEGER,
                    reason TEXT DEFAULT '',
                    banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY(server_id, user_id),
                    FOREIGN KEY(server_id) REFERENCES servers(id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')
                
    # Server Channel Messages table
    c.execute('''CREATE TABLE IF NOT EXISTS channel_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id TEXT NOT NULL,
                    sender_id INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(channel_id) REFERENCES channels(id),
                    FOREIGN KEY(sender_id) REFERENCES users(id)
                )''')
                
    # --- RICH CHAT UPGRADES ---
    # Add attachment columns
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_url TEXT")
    except: pass
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_type TEXT") # image, video, file
    except: pass
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN attachment_name TEXT")
    except: pass
    
    # Add editing columns
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN edited_at TIMESTAMP")
    except: pass
    # --------------------------

    # --- FAZ 2: AUDIT LOG ---
    c.execute('''CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    target_type TEXT,
                    target_id TEXT,
                    details TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(server_id) REFERENCES servers(id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')

    # --- FAZ 3: CHAT ENRICHMENT ---
    
    # Message Reactions
    c.execute('''CREATE TABLE IF NOT EXISTS message_reactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    emoji TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(message_id, user_id, emoji),
                    FOREIGN KEY(message_id) REFERENCES channel_messages(id),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )''')

    # Reply support: add reply_to_id column
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN reply_to_id INTEGER")
    except: pass

    # Pin support: add is_pinned column
    try:
        c.execute("ALTER TABLE channel_messages ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
    except: pass

    # --- FAZ 4: ORGANIZATION ---
    
    # Channel Categories
    c.execute('''CREATE TABLE IF NOT EXISTS categories (
                    id TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    position INTEGER DEFAULT 0,
                    FOREIGN KEY(server_id) REFERENCES servers(id)
                )''')
    
    # Channel position + category
    try:
        c.execute("ALTER TABLE channels ADD COLUMN category_id TEXT")
    except: pass
    try:
        c.execute("ALTER TABLE channels ADD COLUMN position INTEGER DEFAULT 0")
    except: pass
    
    # Server icon + description
    try:
        c.execute("ALTER TABLE servers ADD COLUMN icon_url TEXT")
    except: pass
    try:
        c.execute("ALTER TABLE servers ADD COLUMN description TEXT DEFAULT ''")
    except: pass

    # Invites table (advanced invite system)
    c.execute('''CREATE TABLE IF NOT EXISTS invites (
                    code TEXT PRIMARY KEY,
                    server_id TEXT NOT NULL,
                    creator_id INTEGER NOT NULL,
                    max_uses INTEGER DEFAULT 0,
                    uses INTEGER DEFAULT 0,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(server_id) REFERENCES servers(id),
                    FOREIGN KEY(creator_id) REFERENCES users(id)
                )''')

    conn.commit()
    conn.close()
