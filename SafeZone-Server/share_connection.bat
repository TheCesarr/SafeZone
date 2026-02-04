@echo off
title SafeZone ONLINE Modu
color 0B
echo.
echo ========================================================
echo   SAFEZONE BAGLANTI SIHIRBAZI 🧙‍♂️
echo ========================================================
echo.
echo 1. IP Adresiniz Aliniyor (Bu tünel şifresidir)...
for /f "delims=" %%i in ('curl -s ifconfig.me') do set IP=%%i
echo.
echo    SENIN IP ADRESIN (SIFRE): %IP%
echo.
echo 2. Tünel Başlatılıyor...
echo.
echo    Lutfen aşağıda çıkan linki arkadaşına at.
echo    ARKADAŞIN O LİNKE *ÖNCE TARAYICIDAN* GİRMELİ.
echo    Karşısına şifre sorarsa yukaridaki IP'yi (%IP%) yapıştırsın.
echo    Siteye erişince ("status": "online" yazısını görünce)
echo    UYGULAMAYI AÇIP BAĞLANABİLİR.
echo.
echo ========================================================

call npm install -g localtunnel
lt --port 8000

pause
