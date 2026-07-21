@echo off
setlocal
cd /d "%~dp0.."
set BIN=%CD%\tools\bin
set DLL=%BIN%\LibreHardwareMonitorLib.dll
set MEM=%BIN%\System.Memory.dll
if exist "%DLL%" if exist "%MEM%" (
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
  "$names=@(" ^
  "  'LibreHardwareMonitorLib.dll','HidSharp.dll','System.Memory.dll','System.Buffers.dll'," ^
  "  'System.Numerics.Vectors.dll','System.Runtime.CompilerServices.Unsafe.dll'," ^
  "  'System.Collections.Immutable.dll','System.Text.Json.dll','System.Text.Encodings.Web.dll'," ^
  "  'System.IO.Pipelines.dll','System.Threading.Tasks.Extensions.dll'," ^
  "  'Microsoft.Bcl.AsyncInterfaces.dll','Microsoft.Bcl.HashCode.dll'," ^
  "  'BlackSharp.Core.dll','RAMSPDToolkit-NDD.dll','DiskInfoToolkit.dll'," ^
  "  'System.CodeDom.dll','System.Formats.Nrbf.dll','System.Reflection.Metadata.dll'," ^
  "  'System.Resources.Extensions.dll','System.Security.AccessControl.dll'," ^
  "  'System.Security.Principal.Windows.dll','System.Threading.AccessControl.dll'" ^
  ");" ^
  "foreach ($n in $names) {" ^
  "  $f=Get-ChildItem -Path $dest -Recurse -Filter $n -File | Select-Object -First 1;" ^
  "  if ($f) { Copy-Item -Force $f.FullName (Join-Path '%BIN%' $n) }" ^
  "};" ^
  "Remove-Item -Force $zip -ErrorAction SilentlyContinue;" ^
  "Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue"
if not exist "%DLL%" (
  echo LHM download failed.
  exit /b 1
)
if not exist "%MEM%" (
  echo Warning: System.Memory.dll missing - LHM Open may fail.
)
echo OK %DLL%
exit /b 0
