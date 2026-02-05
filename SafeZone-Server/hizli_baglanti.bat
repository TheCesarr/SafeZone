@echo off
title SafeZone HIZLI Baglanti
color 0E
echo.
echo ========================================================
echo   SAFEZONE HIZLI BAGLANTI REHBERI 🚀
echo ========================================================
echo.
echo [1] Baglanti kuruluyor... (Birkac saniye bekleyin)
echo.
echo [2] En alttaki CIKTIYA DIKKAT ET.
echo    Ornek Cikti: "abcd.lhr.life tunneled with tls..."
echo.
echo [3] LINKIN SADECE SU KISMINI AL:
echo    "abcd.lhr.life" veya "xyzt.localhost.run"
echo    (Yani https:// olmadan, sadece domain ismi)
echo.
echo [4] Arkadasina bu domain ismini gonder.
echo.
echo PENCEREYI KAPATMA! BAGLANDI...
echo ========================================================
echo.

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -R 80:localhost:8000 serveo.net

echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo BAGLANTI KOPTU! Tekrar calistir.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
pause
