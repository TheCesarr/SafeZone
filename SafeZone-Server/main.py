from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from utils import log_event, LOG_FILE, logger
import uvicorn
import os
import datetime

# Routers
from routers import auth, server, channel, friends, chat, user, admin

# App Init
app = FastAPI(title="SafeZone Backend", version="1.0.3")

# Setup
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# CORS: read from env for production hardening
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins
    else [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "http://31.57.156.201",
        "https://31.57.156.201",
        "app://.",           # Electron renderer
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Init Database
init_db()
from database import init_admin
init_admin()

# Include Routers
app.include_router(auth.router)
app.include_router(server.router)
app.include_router(channel.router)
app.include_router(friends.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    log_event("HTTP", "Root endpoint accessed")
    return {"status": "online", "server": "SafeZone-TR-1", "auth_enabled": True}

if __name__ == "__main__":
    logger.info("============================================")
    logger.info("   SAFEZONE SUNUCUSU BAŞLATILIYOR... 🚀")
    logger.info("   (Loglar server_log.txt dosyasına kaydediliyor)")
    logger.info("============================================")

    uvicorn.run("main:app", host="0.0.0.0", port=8000, log_level="warning", reload=False)
