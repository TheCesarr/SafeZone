#!/bin/bash

# SafeZone Update Script
# Run this whenever you push new code to GitHub

echo "🚀 SafeZone Guncelleniyor..."

# 1. Pull Latest Code
cd /root/SafeZone
echo "⬇️ Kodlar indiriliyor (Git Pull)..."
git pull

# 2. Update Dependencies
echo "📦 Paketler guncelleniyor..."
cd SafeZone-Server
source venv/bin/activate
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    pip install fastapi uvicorn websockets pydantic bcrypt python-multipart
fi

# 3. Restart Service
echo "🔄 Servis yeniden baslatiliyor..."
systemctl restart safezone
systemctl status safezone --no-pager

echo ""
echo "✅ GUNCELLEME TAMAMLANDI!"
