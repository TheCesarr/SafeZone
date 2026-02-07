
import sqlite3
import os

db_path = "SafeZone-Server/safezone.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("PRAGMA table_info(members);")
    columns = c.fetchall()
    print("Members Table Schema:")
    for col in columns:
        print(col)
    conn.close()
else:
    print("DB not found")
