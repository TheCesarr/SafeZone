import sqlite3
import csv
import os

DB_FILE = "safezone.db"
CSV_FILE = "kullanicilar.csv"

def export_to_csv():
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT * FROM users")
        rows = c.fetchall()
        
        # Get column names
        names = [description[0] for description in c.description]
        
        with open(CSV_FILE, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow(names) # Header
            writer.writerows(rows) # Data
            
        print(f"BAŞARILI: Veriler '{CSV_FILE}' dosyasına kaydedildi.")
        print(f"Toplam {len(rows)} kullanıcı aktarıldı.")
        
    except Exception as e:
        print(f"HATA: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    export_to_csv()
