@echo off
setlocal
cd /d "%~dp0.."
set BIN=%CD%\tools\bin
set DLL=%BIN%\LibreHardwareMonitorLib.dll
set HID=%BIN%\HidSharp.dll
if exist "%DLL%" if exist "%HID%" (
  echo LHM DLLs already present: %BIN%
  exit /b 0
)
echo Downloading LibreHardwareMonitor v0.9.6...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "New-Item -ItemType Directory -Force -Path '%BIN%' | Out-Null;" ^
  "$zip=Join-Path $env:TEMP 'lhm-opti.zip';" ^
  "$u='https://github.com/LibreHardwareMonitor/LibreHardwareMonitor/releases/download/v0.9.6/LibreHardwareMonitor.zip';" ^
  "Invoke-WebRequest -Uri $u -OutFile $zip -UseBasicParsing;" ^
  "$dest=Join-Path $env:TEMP 'lhm-opti-extract';" ^
  "if (Test-Path $dest) { Remove-Item -Recurse -Force $dest };" ^
  "Expand-Archive -Path $zip -DestinationPath $dest -Force;" ^
  "$lib=Get-ChildItem -Path $dest -Recurse -Filter 'LibreHardwareMonitorLib.dll' | Select-Object -First 1;" ^
  "$hid=Get-ChildItem -Path $dest -Recurse -Filter 'HidSharp.dll' | Select-Object -First 1;" ^
  "if (-not $lib) { throw 'LibreHardwareMonitorLib.dll not found in zip' };" ^
  "Copy-Item -Force $lib.FullName '%DLL%';" ^
  "if ($hid) { Copy-Item -Force $hid.FullName '%HID%' };" ^
  "Remove-Item -Force $zip -ErrorAction SilentlyContinue;" ^
  "Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue"
if not exist "%DLL%" (
  echo LHM download failed.
  exit /b 1
)
if not exist "%HID%" (
  echo Warning: HidSharp.dll missing - some sensors may be unavailable.
)
echo OK %DLL%
exit /b 0
