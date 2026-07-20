@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Opti — Prérequis
echo.
echo  Installation des prérequis (admin recommandé) :
echo    - Microsoft Edge WebView2 Runtime
echo    - Visual C++ Redistributable x64
echo.
if not exist "%~dp0prereqs\MicrosoftEdgeWebview2Setup.exe" (
  echo [WARN] WebView2 setup manquant dans prereqs\
) else (
  echo [..] WebView2...
  start /wait "" "%~dp0prereqs\MicrosoftEdgeWebview2Setup.exe" /silent /install
)
if not exist "%~dp0prereqs\VC_redist.x64.exe" (
  echo [WARN] VC_redist manquant dans prereqs\
) else (
  echo [..] VC++ x64...
  start /wait "" "%~dp0prereqs\VC_redist.x64.exe" /install /quiet /norestart
)
echo.
echo  [OK] Terminé. Lancez ensuite Lancer.cmd ou Opti.exe
pause
