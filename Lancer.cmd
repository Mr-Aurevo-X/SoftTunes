@echo off
cd /d "%~dp0"
if exist "%~dp0Opti.exe" (
  start "" "%~dp0Opti.exe"
  exit /b 0
)
where py >nul 2>&1 && (
  py -3 "%~dp0host\opti_host.py"
  exit /b %ERRORLEVEL%
)
python "%~dp0host\opti_host.py"
