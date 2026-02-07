import datetime

LOG_FILE = "server_log.txt"

def log_event(event_type: str, message: str):
    time_str = datetime.datetime.now().strftime("%H:%M:%S")
    prefix = ""
    if event_type == "CONNECT":
        prefix = "[+] BAGLANDI"
    elif event_type == "DISCONNECT":
        prefix = "[-] AYRILDI "
    elif event_type == "ERROR":
        prefix = "[!] HATA    "
    else:
        prefix = f"[*] {event_type:<8}"
    
    log_line = f"{time_str} | {prefix} | {message}"
    print(log_line)
    
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
    except Exception as e:
        print(f"Log yazma hatasi: {e}")
