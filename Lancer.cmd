@echo off
cd /d "%~dp0"
where python >nul 2>&1
if %errorlevel%==0 (
  if exist "%~dp0host\opti_host.py" (
    python "%~dp0host\opti_host.py"
    exit /b %errorlevel%
  )
)
if exist "%~dp0SoftTunes.exe" (
  start "" "%~dp0SoftTunes.exe"
  exit /b 0
)
if exist "%~dp0Opti.exe" (
  start "" "%~dp0Opti.exe"
  exit /b 0
)
echo [ERROR] SoftTunes.exe / Opti.exe introuvable et Python absent.
exit /b 1
