
import sqlite3
import os

db_path = "SafeZone-Server/safezone.db"

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        # Check Schema
        print("Schema:")
        c.execute("PRAGMA table_info(users);")
        columns = c.fetchall()
        for col in columns:
            print(col)
            
        print("\nData:")
        c.execute("SELECT * FROM users")
        users = c.fetchall()
        print(f"Total Users: {len(users)}")
        for user in users:
            print(user)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
else:
    print("DB not found")
