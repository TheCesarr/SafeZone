@echo off
title SafeZone Uygulamasi
color 0F
echo.
echo ==========================================
echo   SAFEZONE UYGULAMASI BASLATILIYOR...
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Kutuphaneler kontrol ediliyor...
call npm install --silent
echo Kutuphaneler TAMAM.

echo.
echo [2/2] Uygulama aciliyor...
echo Lutfen bekleyin, beyaz pencere acilacak.
echo.

:: Run blindly without verifying concurrently presence, npm install should have fixed it.
call npm run electron:dev

if %errorlevel% neq 0 (
    echo.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    echo DIYE BIR HATA OLUSTU.
    echo Lutfen bu pencereyi kapatip tekrar deneyin.
    echo Eger surekli hata aliyorsaniz, 'node_modules' klasorunu silip tekrar deneyin.
    echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    pause
)
