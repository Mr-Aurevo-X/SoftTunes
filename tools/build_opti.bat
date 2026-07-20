@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DIST=%ROOT%\dist\Opti

if not exist "%ROOT%\.venv\Scripts\python.exe" (
  python -m venv "%ROOT%\.venv"
  "%ROOT%\.venv\Scripts\pip" install -r "%ROOT%\requirements.txt" pyinstaller
)

"%ROOT%\.venv\Scripts\python" "%ROOT%\tools\minify_js.py"

"%ROOT%\.venv\Scripts\python" -m PyInstaller --noconfirm --clean --onedir --windowed --noupx ^
  --name "Opti" ^
  --icon "%ROOT%\logo-opti.ico" ^
  --version-file "%ROOT%\tools\file_version_info.txt" ^
  --add-data "%ROOT%\build\ui_stage;ui" ^
  --hidden-import "clr" ^
  --distpath "%ROOT%\dist" ^
  --workpath "%ROOT%\host\build" ^
  --specpath "%ROOT%\host" ^
  "%ROOT%\host\opti_host.py"

if not exist "%DIST%\Opti.exe" (
  echo Build failed.
  exit /b 1
)

xcopy /E /I /Y "%ROOT%\api" "%DIST%\api\" >nul
xcopy /E /I /Y "%ROOT%\modules" "%DIST%\modules\" >nul
xcopy /E /I /Y "%ROOT%\lists" "%DIST%\lists\" >nul
xcopy /E /I /Y "%ROOT%\ui" "%DIST%\ui\" >nul
if exist "%ROOT%\build\ui_stage\app.js" copy /Y "%ROOT%\build\ui_stage\app.js" "%DIST%\ui\app.js" >nul
copy /Y "%ROOT%\logo-opti.ico" "%DIST%\logo-opti.ico" >nul

if exist "%ROOT%\Opti-dist" rmdir /S /Q "%ROOT%\Opti-dist"
mkdir "%ROOT%\Opti-dist"
xcopy /E /I /Y "%DIST%\*" "%ROOT%\Opti-dist\" >nul
copy /Y "%DIST%\Opti.exe" "%ROOT%\Opti.exe" >nul

echo.
echo OK onedir: %DIST%
echo OK Opti-dist: %ROOT%\Opti-dist
exit /b 0
