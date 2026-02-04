import sqlite3
import os

DB_FILE = "safezone.db"

def clear_users():
    if not os.path.exists(DB_FILE):
        print("Veritabanı dosyası bulunamadı, zaten temiz.")
        return

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        
        # Count before delete
        c.execute("SELECT count(*) FROM users")
        count = c.fetchone()[0]
        
        c.execute("DELETE FROM users")
        conn.commit()
        print(f"TEMİZLİK TAMAMLANDI: Toplam {count} kullanıcı silindi.")
        
        # Reset ID counter
        try:
            c.execute("DELETE FROM sqlite_sequence WHERE name='users'")
            conn.commit()
            print("ID sayacı sıfırlandı.")
        except:
            pass
            
        conn.close()
        
    except Exception as e:
        print(f"HATA: {e}")

if __name__ == "__main__":
    confirm = input("TÜM KULLANICILAR SİLİNECEK! Emin misin? (e/h): ")
    if confirm.lower() == 'e':
        clear_users()
    else:
        print("İşlem iptal edildi.")
