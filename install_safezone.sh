#!/bin/bash

# SafeZone VDS Installation Script
# Run this on your Ubuntu 22.04+ Server

echo "🚀 SafeZone Kurulumu Basliyor..."

# 1. Update System
echo "📦 Sistem guncelleniyor..."
apt update && apt upgrade -y

# 2. Install Dependencies
echo "📦 Gerekli paketler yukleniyor (Python, Git, UFW)..."
apt install -y python3 python3-pip python3-venv git ufw

# 3. Setup Firewall
echo "🛡️ Guvenlik duvari (Firewall) ayarlaniyor..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 8000/tcp # SafeZone API
ufw --force enable
ufw status

# 4. Clone Repository
echo "⬇️ SafeZone kodlari indiriliyor..."
cd /root
if [ -d "SafeZone" ]; then
    echo "⚠️ Klasor zaten var, guncelleniyor..."
    cd SafeZone
    git pull
else
    git clone https://github.com/TheCesarr/SafeZone.git
fi

# 5. Setup Python Environment
echo "🐍 Python ortami hazirlaniyor..."
cd /root/SafeZone/SafeZone-Server
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    pip install fastapi uvicorn websockets pydantic bcrypt python-multipart
fi

# 6. Create Service (Systemd)
echo "⚙️ Servis dosyasi olusturuluyor..."
cat <<EOF > /etc/systemd/system/safezone.service
[Unit]
Description=SafeZone Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/root/SafeZone/SafeZone-Server
ExecStart=/root/SafeZone/SafeZone-Server/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 7. Start Service
echo "🚀 Servis baslatiliyor..."
systemctl daemon-reload
systemctl enable safezone
systemctl start safezone
systemctl status safezone --no-pager

echo ""
echo "✅ KURULUM TAMAMLANDI!"
echo "Server IP: $(curl -s ifconfig.me)"
echo "Backend: http://$(curl -s ifconfig.me):8000"
