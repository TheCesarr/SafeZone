@echo off
title SafeZone Sunucusu
color 0A
echo SafeZone Sunucusu Baslatiliyor...
echo.
echo Lutfen bu pencereyi KAPATMAYIN. Arkadaslariniz baglanabilsin.
echo Sunucu aktif oldugunda "Uvicorn running on..." yazisi cikacak.
echo.

cd /d "%~dp0"
pip install -r requirements.txt
cls
python main.py

pause
