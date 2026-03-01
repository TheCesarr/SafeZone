@echo off
echo ============================================================
echo  [!!] UYARI: Bu dosya artik KULLANILMIYOR.
echo  Guncel deploy yontemi: Git Push + Sunucuda ./update_safezone.sh
echo ============================================================
echo.
echo Yeni deploy adimlari:
echo  1. Degisiklikleri commit et: git add . ve git commit -m "mesaj"
echo  2. GitHub'a gonder: git push
echo  3. Sunucuya SSH ile baglan: ssh root@31.57.156.201
echo  4. Sunucuda guncelle: cd /root/SafeZone ve ./update_safezone.sh
echo.
pause
