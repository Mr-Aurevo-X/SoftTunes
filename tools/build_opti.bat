@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DIST=%ROOT%\dist\Opti

if not exist "%ROOT%\.venv\Scripts\python.exe" (
  python -m venv "%ROOT%\.venv"
  "%ROOT%\.venv\Scripts\pip" install -r "%ROOT%\requirements.txt" pyinstaller
)

"%ROOT%\.venv\Scripts\python" "%ROOT%\tools\minify_js.py"

call "%ROOT%\tools\download_presentmon.bat"
if errorlevel 1 exit /b 1

"%ROOT%\.venv\Scripts\python" -m PyInstaller --noconfirm --clean --onedir --windowed --noupx ^
  --name "Opti" ^
  --paths "%ROOT%\host" ^
  --icon "%ROOT%\logo-opti.ico" ^
  --version-file "%ROOT%\tools\file_version_info.txt" ^
  --add-data "%ROOT%\build\ui_stage;ui" ^
  --hidden-import "clr" ^
  --hidden-import "fps_worker" ^
  --hidden-import "presentmon_reader" ^
  --hidden-import "fps_worker_manager" ^
  --hidden-import "fps_overlay" ^
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
if exist "%ROOT%\tools\bin" xcopy /E /I /Y "%ROOT%\tools\bin" "%DIST%\bin\" >nul
copy /Y "%ROOT%\logo-opti.ico" "%DIST%\logo-opti.ico" >nul

if exist "%ROOT%\Opti-dist" rmdir /S /Q "%ROOT%\Opti-dist"
mkdir "%ROOT%\Opti-dist"
xcopy /E /I /Y "%DIST%\*" "%ROOT%\Opti-dist\" >nul

rem Runnable at repo root (onedir: exe + _internal + payload folders; ui\ stays dev source)
copy /Y "%ROOT%\Opti-dist\Opti.exe" "%ROOT%\Opti.exe" >nul
if exist "%ROOT%\_internal" rmdir /S /Q "%ROOT%\_internal"
xcopy /E /I /Y "%ROOT%\Opti-dist\_internal" "%ROOT%\_internal\" >nul
xcopy /E /I /Y "%ROOT%\Opti-dist\api" "%ROOT%\api\" >nul
xcopy /E /I /Y "%ROOT%\Opti-dist\modules" "%ROOT%\modules\" >nul
xcopy /E /I /Y "%ROOT%\Opti-dist\lists" "%ROOT%\lists\" >nul
if exist "%ROOT%\Opti-dist\bin" xcopy /E /I /Y "%ROOT%\Opti-dist\bin" "%ROOT%\bin\" >nul
if exist "%ROOT%\Opti-dist\logo-opti.ico" copy /Y "%ROOT%\Opti-dist\logo-opti.ico" "%ROOT%\logo-opti.ico" >nul
rem Do not copy a lone Opti.exe without _internal — both are deployed above.

echo.
echo OK onedir: %DIST%
echo OK Opti-dist: %ROOT%\Opti-dist
echo Run: Opti-dist\Opti.exe  (or OptiSetup.exe after tools\build_setup.bat)
exit /b 0
