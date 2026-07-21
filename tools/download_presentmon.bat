@echo off
setlocal
cd /d "%~dp0.."
set OUT=%CD%\tools\bin\PresentMon-x64.exe
if exist "%OUT%" (
  echo PresentMon already present: %OUT%
  exit /b 0
)
echo Downloading PresentMon 2.3.1...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='https://github.com/GameTechDev/PresentMon/releases/download/v2.3.1/PresentMon-2.3.1-x64.exe';" ^
  "New-Item -ItemType Directory -Force -Path '%CD%\tools\bin' | Out-Null;" ^
  "Invoke-WebRequest -Uri $u -OutFile '%OUT%' -UseBasicParsing"
if not exist "%OUT%" (
  echo Download failed.
  exit /b 1
)
echo OK %OUT%
exit /b 0
