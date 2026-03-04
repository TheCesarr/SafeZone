import sqlite3
import os
import secrets
import bcrypt

DB_NAME = "safezone.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    # WAL mode: prevents "database is locked" errors under concurrent WebSocket writes
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")  # Safe performance boost with WAL
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# ─────────────────────────────────────────────────────────────────────────────
#  Versioned Migration System
#
#  Each entry in MIGRATIONS is a (version, description, sql) tuple.
#  Migrations are applied in order, exactly once, tracked by schema_migrations.
#  Rules:
#   - Never edit an already-released migration. Add a new one instead.
#   - SQL can be any valid SQLite DDL/DML. Use semicolons to separate statements
#     inside a single migration if needed (execute_script is used).
#   - A migration that fails will be rolled back and will stop server startup.
# ─────────────────────────────────────────────────────────────────────────────

MIGRATIONS = [
    # ── v1: baseline schema (all original CREATE TABLE IF NOT EXISTS)
    (1, "Initial schema",
     """
     CREATE TABLE IF NOT EXISTS users (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         username TEXT NOT NULL,
         discriminator TEXT NOT NULL,
         email TEXT UNIQUE,
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
     );

     CREATE TABLE IF NOT EXISTS servers (
         id TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         owner_id INTEGER NOT NULL,
         invite_code TEXT UNIQUE,
         icon_url TEXT,
         description TEXT DEFAULT '',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         deleted_at TIMESTAMP
     );

     CREATE TABLE IF NOT EXISTS channels (
         id TEXT PRIMARY KEY,
         server_id TEXT NOT NULL,
         name TEXT NOT NULL,
         type TEXT NOT NULL,
         category_id TEXT,
         position INTEGER DEFAULT 0,
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS members (
         server_id TEXT NOT NULL,
         user_id INTEGER NOT NULL,
         role TEXT DEFAULT 'member',
         joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY(server_id, user_id),
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS friends (
         user_id INTEGER NOT NULL,
         friend_id INTEGER NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY(user_id, friend_id),
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
         FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS messages (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         sender_id INTEGER NOT NULL,
         receiver_id INTEGER NOT NULL,
         content TEXT NOT NULL,
         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         is_read BOOLEAN DEFAULT 0,
         edited_at TIMESTAMP,
         FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
         FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS roles (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         server_id TEXT NOT NULL,
         name TEXT NOT NULL,
         color TEXT NOT NULL,
         position INTEGER NOT NULL,
         permissions INTEGER DEFAULT 0,
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS user_roles (
         user_id INTEGER NOT NULL,
         role_id INTEGER NOT NULL,
         server_id TEXT NOT NULL,
         PRIMARY KEY(user_id, role_id, server_id),
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
         FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS friend_requests (
         sender_id INTEGER NOT NULL,
         receiver_id INTEGER NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY(sender_id, receiver_id),
         FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS bans (
         server_id TEXT NOT NULL,
         user_id INTEGER NOT NULL,
         banned_by INTEGER,
         reason TEXT DEFAULT '',
         banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY(server_id, user_id),
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS channel_messages (
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
     );

     CREATE TABLE IF NOT EXISTS audit_log (
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
     );

     CREATE TABLE IF NOT EXISTS message_reactions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         message_id INTEGER NOT NULL,
         user_id INTEGER NOT NULL,
         emoji TEXT NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(message_id, user_id, emoji),
         FOREIGN KEY(message_id) REFERENCES channel_messages(id) ON DELETE CASCADE,
         FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS categories (
         id TEXT PRIMARY KEY,
         server_id TEXT NOT NULL,
         name TEXT NOT NULL,
         position INTEGER DEFAULT 0,
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS invites (
         code TEXT PRIMARY KEY,
         server_id TEXT NOT NULL,
         creator_id INTEGER NOT NULL,
         max_uses INTEGER DEFAULT 0,
         uses INTEGER DEFAULT 0,
         expires_at TIMESTAMP,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY(server_id) REFERENCES servers(id) ON DELETE CASCADE,
         FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE CASCADE
     );

     CREATE TABLE IF NOT EXISTS voice_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         channel_id TEXT NOT NULL,
         channel_name TEXT NOT NULL,
         user_id TEXT NOT NULL,
         action TEXT NOT NULL,
         timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE CASCADE
     );
     """),

    # ── v2: add custom_status + preferred_status to users
    (2, "Add custom_status and preferred_status to users",
     """
     ALTER TABLE users ADD COLUMN custom_status TEXT;
     ALTER TABLE users ADD COLUMN preferred_status TEXT DEFAULT 'online';
     """),

    # ── v3: add message edit history table
    (3, "Add message_edit_history table",
     """
     CREATE TABLE IF NOT EXISTS message_edit_history (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         message_id INTEGER NOT NULL,
         old_content TEXT NOT NULL,
         edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         FOREIGN KEY(message_id) REFERENCES channel_messages(id) ON DELETE CASCADE
     );
     """),

    # ─────────────────────────────────────────────────────────────────────────
    # ADD NEW MIGRATIONS BELOW THIS LINE
    # Format: (version_number, "Short description", "SQL;")
    # ─────────────────────────────────────────────────────────────────────────
]


def _get_applied_versions(conn) -> set:
    """Return the set of migration version numbers already applied."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {row[0] for row in rows}


def run_migrations():
    """
    Apply any pending migrations in order.
    Each migration runs in its own transaction; a failure rolls back only that
    migration and raises an exception that stops server startup.
    Progress is printed to stdout so it appears in server logs.
    """
    conn = get_db_connection()
    try:
        applied = _get_applied_versions(conn)
        pending = [(v, desc, sql) for v, desc, sql in MIGRATIONS if v not in applied]

        if not pending:
            print("[Migrations] Schema is up to date.")
            return

        for version, description, sql in sorted(pending, key=lambda x: x[0]):
            print(f"[Migrations] Applying v{version}: {description}...")
            try:
                # Use executescript for multi-statement SQL (it auto-commits)
                conn.executescript(sql)
                # Record success inside its own transaction
                conn.execute(
                    "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
                    (version, description)
                )
                conn.commit()
                print(f"[Migrations] ✓ v{version} applied.")
            except Exception as e:
                conn.rollback()
                raise RuntimeError(
                    f"[Migrations] FAILED at v{version} ({description}): {e}"
                ) from e

        print(f"[Migrations] Done. Applied {len(pending)} migration(s).")
    finally:
        conn.close()


# ─── Legacy shim — kept so existing imports don't break ───────────────────────
def migrate_db():
    """Deprecated: use run_migrations(). Kept for backwards compatibility."""
    run_migrations()


def init_db():
    """Bootstrap the database: run all pending migrations."""
    run_migrations()


def init_admin():
    """Ensure ADMIN#0001 user exists."""
    conn = get_db_connection()
    c = conn.cursor()

    c.execute("SELECT * FROM users WHERE discriminator = '0001' AND is_sysadmin = 1")
    admin = c.fetchone()

    if not admin:
        print("Creating Default ADMIN#0001 User...")
        pw = secrets.token_urlsafe(16)
        hashed = bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        try:
            c.execute(
                """INSERT INTO users
                   (username, discriminator, email, password_hash, display_name, is_sysadmin, avatar_color)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                ('ADMIN', '0001', 'admin@safezone.local', hashed, 'System Admin', 1, '#ED4245')
            )
            conn.commit()
            print(f"ADMIN Created. Password (if needed): {pw}")
        except sqlite3.IntegrityError:
            print("Admin creation failed (might already exist with different params).")

    conn.close()


if __name__ == "__main__":
    run_migrations()
    init_admin()
    print("Database initialized.")
