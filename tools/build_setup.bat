@echo off
cd /d "%~dp0.."
set ROOT=%CD%

if not exist "%ROOT%\Opti-dist\Opti.exe" (
  echo Build Opti first: tools\build_opti.bat
  exit /b 1
)

"%ROOT%\.venv\Scripts\python" -m PyInstaller --noconfirm --clean --onefile --console --noupx ^
  --name "OptiSetup" ^
  --icon "%ROOT%\logo-opti.ico" ^
  --version-file "%ROOT%\tools\file_version_info.txt" ^
  --add-data "%ROOT%\Opti-dist;Opti-dist" ^
  --distpath "%ROOT%\dist" ^
  --workpath "%ROOT%\host\build_setup" ^
  --specpath "%ROOT%\host" ^
  "%ROOT%\host\opti_setup.py"

if exist "%ROOT%\dist\OptiSetup.exe" (
  copy /Y "%ROOT%\dist\OptiSetup.exe" "%ROOT%\OptiSetup.exe" >nul
  echo OK: %ROOT%\OptiSetup.exe
) else (
  echo Setup build failed.
  exit /b 1
)
