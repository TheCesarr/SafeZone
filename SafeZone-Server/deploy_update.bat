@echo off
echo Sunucuya Chat Fix Dosyasi Yukleniyor...
echo Lutfen sifreyi giriniz: lzPCxWq2Ij9EdrUt
scp routers/chat.py root@31.57.156.201:/root/SafeZone/routers/chat.py

echo.
echo Sunucu Servisi Yeniden Baslatiliyor...
echo Lutfen sifreyi tekrar giriniz (eger sorulursa):
ssh root@31.57.156.201 "systemctl restart safezone"

echo.
echo Islem Tamamlandi!
pause
