@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Opti — Desinstallation
echo.
echo  Retire l'installation :
echo    %LOCALAPPDATA%\Programs\Opti
echo  + raccourcis Bureau / menu Demarrer
echo.
set /p OK="Confirmer ? (O/N) "
if /I not "%OK%"=="O" if /I not "%OK%"=="Y" exit /b 0

set "DEST=%LOCALAPPDATA%\Programs\Opti"
if exist "%DEST%" rmdir /S /Q "%DEST%"

set "DESK=%USERPROFILE%\Desktop\Opti Mr-Aurevo-X.lnk"
if exist "%DESK%" del /F /Q "%DESK%"
set "SM=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Mr-Aurevo-X\Opti.lnk"
if exist "%SM%" del /F /Q "%SM%"

echo [OK] Desinstalle.
pause
