@echo off
cd /d "%~dp0.."
set ROOT=%CD%

python -m PyInstaller --noconfirm --clean --onefile --windowed ^
  --name "Opti" ^
  --icon "%ROOT%\brand-icon.ico" ^
  --add-data "%ROOT%\ui\index.html;ui" ^
  --add-data "%ROOT%\ui\styles.css;ui" ^
  --add-data "%ROOT%\ui\app.js;ui" ^
  --add-data "%ROOT%\ui\suite-boot.js;ui" ^
  --add-data "%ROOT%\ui\brand-icon.png;ui" ^
  --hidden-import "clr" ^
  --distpath "%ROOT%" ^
  --workpath "%ROOT%\host\build" ^
  --specpath "%ROOT%\host" ^
  "%ROOT%\host\opti_host.py"

if exist "%ROOT%\Opti.exe" (
  echo.
  echo OK: %ROOT%\Opti.exe
) else (
  echo Build failed.
  exit /b 1
)
