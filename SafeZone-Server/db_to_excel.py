import sqlite3
import pandas as pd
from datetime import datetime
import os

DB_PATH = "safezone.db"
OUTPUT_FILE = f"SafeZone_Veri_Dokumu_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

def dump_db():
    print("Veritabanına bağlanılıyor...")
    
    if not os.path.exists(DB_PATH):
        print(f"HATA: {DB_PATH} bulunamadı!")
        return

    conn = sqlite3.connect(DB_PATH)
    
    # Tüm tabloların adlarını al
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall() if row[0] != "sqlite_sequence"]
    
    if not tables:
        print("Veritabanında tablo bulunamadı.")
        conn.close()
        return

    print(f"Bulunan tablolar: {', '.join(tables)}")
    
    # Excel dosyası oluştur
    with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
        for table in tables:
            print(f"'{table}' tablosu dışa aktarılıyor...")
            df = pd.read_sql_query(f"SELECT * FROM {table}", conn)
            
            # Zaman damgalarını daha okunabilir hale getir (opsiyonel)
            for col in df.columns:
                if 'time' in col.lower() or 'date' in col.lower() or '_at' in col.lower():
                    try:
                        # Eğer timestamp ise dönüştür
                        df[col] = pd.to_datetime(df[col], unit='ms')
                    except:
                        pass
                
            df.to_excel(writer, sheet_name=table[:31], index=False) # Excel sheet isimleri max 31 karakter
            
    conn.close()
    print(f"\nBASARILI: Tum veriler '{OUTPUT_FILE}' dosyasina basariyla aktarildi.")
    print("Bu dosyayı resmi kurumlara Excel formatında teslim edebilirsiniz.")

if __name__ == "__main__":
    dump_db()
