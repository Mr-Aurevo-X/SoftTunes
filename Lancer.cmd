@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist "%~dp0Opti.exe" (
  start "" "%~dp0Opti.exe"
  endlocal
  exit /b 0
)

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Opti.exe introuvable et Python absent du PATH.
  pause
  endlocal
  exit /b 1
)

if exist "%~dp0host\host.py" (
  python "%~dp0host\host.py" %*
  endlocal
  exit /b %ERRORLEVEL%
)

echo [ERROR] Ni Opti.exe ni host\host.py.
pause
endlocal
exit /b 1
