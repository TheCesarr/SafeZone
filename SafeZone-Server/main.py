from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from utils import log_event, LOG_FILE
import uvicorn
import os
import datetime

# Routers
from routers import auth, server, channel, friends, chat, user

# App Init
app = FastAPI(title="SafeZone Backend", version="1.0.1")

# Setup
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init Database
init_db()

# Include Routers
app.include_router(auth.router)
app.include_router(server.router)
app.include_router(channel.router)
app.include_router(friends.router)
app.include_router(chat.router)
app.include_router(user.router)

@app.get("/")
async def root():
    log_event("HTTP", "Root endpoint accessed")
    return {"status": "online", "server": "SafeZone-TR-1", "auth_enabled": True}

if __name__ == "__main__":
    # Clear old log
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"--- SERVER STARTED AT {datetime.datetime.now()} ---\n")

    print("============================================")
    print("   SAFEZONE SUNUCUSU BAŞLATILIYOR... 🚀")
    print("   (Modular Refactoring Active)")
    print("   (Loglar server_log.txt dosyasina kaydediliyor)")
    print("============================================")
    
    # SSL KALDIRILDI - SSH TUNEL ICIN HTTP GEREKLI
    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="warning", reload=False)
