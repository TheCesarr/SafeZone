
import sqlite3
import os

db_path = "SafeZone-Server/safezone.db"

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        print("--- CLEANING UP ORPHAN DATA ---")
        
        # 1. Remove members who no longer exist in users table
        c.execute("DELETE FROM members WHERE user_id NOT IN (SELECT id FROM users)")
        orphans_removed = c.rowcount
        print(f"Removed {orphans_removed} orphan member records.")
        
        # 2. Find servers with NO members
        c.execute("SELECT id, name, owner_id FROM servers WHERE id NOT IN (SELECT DISTINCT server_id FROM members)")
        empty_servers = c.fetchall()
        
        print(f"Found {len(empty_servers)} empty servers.")
        
        for srv in empty_servers:
            srv_id = srv[0]
            srv_name = srv[1]
            print(f"Deleting empty server: {srv_name} (ID: {srv_id})")
            
            # Cascade delete everything related to this server
            c.execute("DELETE FROM channel_messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = ?)", (srv_id,))
            c.execute("DELETE FROM channels WHERE server_id = ?", (srv_id,))
            c.execute("DELETE FROM user_roles WHERE server_id = ?", (srv_id,))
            c.execute("DELETE FROM roles WHERE server_id = ?", (srv_id,))
            c.execute("DELETE FROM members WHERE server_id = ?", (srv_id,)) # Already empty but good for completeness
            c.execute("DELETE FROM servers WHERE id = ?", (srv_id,))
            
        conn.commit()
        print("Cleanup complete.")
        
        # Verify
        c.execute("SELECT id, name FROM servers")
        remaining = c.fetchall()
        print(f"\nRemaining Servers ({len(remaining)}):")
        for s in remaining:
            print(s)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
else:
    print("DB not found")
