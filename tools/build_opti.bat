@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DIST=%ROOT%\dist\SoftTunes

if not exist "%ROOT%\.venv\Scripts\python.exe" (
  python -m venv "%ROOT%\.venv"
  "%ROOT%\.venv\Scripts\pip" install -r "%ROOT%\requirements.txt" pyinstaller
)

"%ROOT%\.venv\Scripts\python" "%ROOT%\tools\minify_js.py"

call "%ROOT%\tools\download_presentmon.bat"
if errorlevel 1 exit /b 1

call "%ROOT%\tools\download_lhm.bat"
if errorlevel 1 exit /b 1

"%ROOT%\.venv\Scripts\python" -m PyInstaller --noconfirm --clean --onedir --windowed --noupx ^
  --name "SoftTunes" ^
  --paths "%ROOT%\host" ^
  --icon "%ROOT%\logo-opti.ico" ^
  --version-file "%ROOT%\tools\file_version_info.txt" ^
  --add-data "%ROOT%\build\ui_stage;ui" ^
  --hidden-import "clr" ^
  --hidden-import "fps_worker" ^
  --hidden-import "presentmon_reader" ^
  --hidden-import "fps_worker_manager" ^
  --hidden-import "fps_overlay" ^
  --hidden-import "system_stats" ^
  --hidden-import "window_chrome" ^
  --hidden-import "confirm_gate" ^
  --distpath "%ROOT%\dist" ^
  --workpath "%ROOT%\host\build" ^
  --specpath "%ROOT%\host" ^
  "%ROOT%\host\opti_host.py"

if not exist "%DIST%\SoftTunes.exe" (
  echo Build failed.
  exit /b 1
)

xcopy /E /I /Y "%ROOT%\api" "%DIST%\api\" >nul
xcopy /E /I /Y "%ROOT%\modules" "%DIST%\modules\" >nul
xcopy /E /I /Y "%ROOT%\lists" "%DIST%\lists\" >nul
xcopy /E /I /Y "%ROOT%\ui" "%DIST%\ui\" >nul
if exist "%ROOT%\build\ui_stage\app.js" copy /Y "%ROOT%\build\ui_stage\app.js" "%DIST%\ui\app.js" >nul
if exist "%ROOT%\tools\bin" xcopy /E /I /Y "%ROOT%\tools\bin" "%DIST%\bin\" >nul
copy /Y "%ROOT%\logo-opti.ico" "%DIST%\logo-opti.ico" >nul

if exist "%ROOT%\SoftTunes-dist" rmdir /S /Q "%ROOT%\SoftTunes-dist"
mkdir "%ROOT%\SoftTunes-dist"
xcopy /E /I /Y "%DIST%\*" "%ROOT%\SoftTunes-dist\" >nul

copy /Y "%ROOT%\SoftTunes-dist\SoftTunes.exe" "%ROOT%\SoftTunes.exe" >nul
if exist "%ROOT%\_internal" rmdir /S /Q "%ROOT%\_internal"
xcopy /E /I /Y "%ROOT%\SoftTunes-dist\_internal" "%ROOT%\_internal\" >nul
xcopy /E /I /Y "%ROOT%\SoftTunes-dist\api" "%ROOT%\api\" >nul
xcopy /E /I /Y "%ROOT%\SoftTunes-dist\modules" "%ROOT%\modules\" >nul
xcopy /E /I /Y "%ROOT%\SoftTunes-dist\lists" "%ROOT%\lists\" >nul
if exist "%ROOT%\SoftTunes-dist\bin" xcopy /E /I /Y "%ROOT%\SoftTunes-dist\bin" "%ROOT%\bin\" >nul
if exist "%ROOT%\SoftTunes-dist\logo-opti.ico" copy /Y "%ROOT%\SoftTunes-dist\logo-opti.ico" "%ROOT%\logo-opti.ico" >nul

echo.
echo OK onedir: %DIST%
echo OK SoftTunes-dist: %ROOT%\SoftTunes-dist
echo Run: SoftTunes-dist\SoftTunes.exe
exit /b 0
