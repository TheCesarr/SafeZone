
import sqlite3
import bcrypt
import os

db_path = "SafeZone-Server/safezone.db"
username = "admin"
password_to_check = "1234"

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = c.fetchone()
        
        if user:
            stored_hash = user['password_hash']
            print(f"User found: {user['username']}")
            print(f"Stored Hash: {stored_hash}")
            
            if bcrypt.checkpw(password_to_check.encode('utf-8'), stored_hash.encode('utf-8')):
                print("SUCCESS: Password '1234' matches the stored hash.")
            else:
                print("FAILURE: Password '1234' DOES NOT match the stored hash.")
        else:
            print(f"User '{username}' not found.")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
else:
    print("DB not found")
