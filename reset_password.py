
import sqlite3
import bcrypt
import os

db_path = "SafeZone-Server/safezone.db"
username = "admin"
new_password = "1234"

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        
        # Hash the new password
        hashed_pw_bytes = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        hashed_pw_str = hashed_pw_bytes.decode('utf-8')
        
        # Update the user
        c.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hashed_pw_str, username))
        
        if c.rowcount > 0:
            print(f"Password for user '{username}' has been reset successfully.")
        else:
            print(f"User '{username}' not found.")
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
else:
    print("DB not found")
