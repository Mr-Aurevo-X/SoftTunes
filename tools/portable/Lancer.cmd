@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "Get-ChildItem -LiteralPath '%~dp0' -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1
if exist "%~dp0SoftTunes.exe" (
  start "" "%~dp0SoftTunes.exe"
  exit /b 0
)
if exist "%~dp0Opti.exe" (
  start "" "%~dp0Opti.exe"
  exit /b 0
)
echo SoftTunes.exe introuvable. Ce dossier doit contenir SoftTunes.exe et _internal.
exit /b 1
