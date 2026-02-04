import sqlite3
import os

print("\n--- SAFEZONE KULLANICI LISTESI ---")
try:
    conn = sqlite3.connect("safezone.db")
    c = conn.cursor()
    c.execute("SELECT * FROM users")
    rows = c.fetchall()
    
    # Header
    print(f"{'ID':<4} | {'KULLANICI ADI':<15} | {'GORUNEN ISIM':<15} | {'TOKEN (KISMI)':<15}")
    print("-" * 60)
    
    for r in rows:
        # id=0, username=1, password_hash=2, display_name=3, token=4
        u_id = str(r[0])
        username = r[1]
        display = r[3]
        token = str(r[4])[:8] + "..." if r[4] else "YOK"
        
        print(f"{u_id:<4} | {username:<15} | {display:<15} | {token:<15}")

    print("-" * 60)
    print(f"TOPLAM: {len(rows)} Kayıt\n")
        
    conn.close()
except Exception as e:
    print(f"HATA: {e}")
