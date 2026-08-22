@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DIST=%ROOT%\dist\SoftTunes

if not exist "%ROOT%\.venv\Scripts\python.exe" (
  python -m venv "%ROOT%\.venv"
  "%ROOT%\.venv\Scripts\pip" install -r "%ROOT%\requirements.txt" pyinstaller pythonnet
)

"%ROOT%\.venv\Scripts\python" "%ROOT%\tools\minify_js.py"

call "%ROOT%\tools\download_presentmon.bat"
if errorlevel 1 exit /b 1

call "%ROOT%\tools\download_lhm.bat"
if errorlevel 1 exit /b 1

"%ROOT%\.venv\Scripts\python" -m PyInstaller --noconfirm --clean ^
  --distpath "%ROOT%\dist" ^
  --workpath "%ROOT%\host\build" ^
  "%ROOT%\host\Opti.spec"

if not exist "%DIST%\SoftTunes.exe" (
  echo Build failed.
  exit /b 1
)

copy /Y "%ROOT%\host\SoftTunes.exe.config" "%DIST%\SoftTunes.exe.config" >nul
xcopy /E /I /Y "%ROOT%\api" "%DIST%\api\" >nul
xcopy /E /I /Y "%ROOT%\modules" "%DIST%\modules\" >nul
xcopy /E /I /Y "%ROOT%\lists" "%DIST%\lists\" >nul
xcopy /E /I /Y "%ROOT%\ui" "%DIST%\ui\" >nul
if exist "%ROOT%\build\ui_stage\app.js" copy /Y "%ROOT%\build\ui_stage\app.js" "%DIST%\ui\app.js" >nul
if exist "%ROOT%\tools\bin" xcopy /E /I /Y "%ROOT%\tools\bin" "%DIST%\bin\" >nul
copy /Y "%ROOT%\logo-opti.ico" "%DIST%\logo-opti.ico" >nul
copy /Y "%ROOT%\version.json" "%DIST%\version.json" >nul
copy /Y "%ROOT%\README.md" "%DIST%\README.md" >nul
copy /Y "%ROOT%\README.en.md" "%DIST%\README.en.md" >nul
copy /Y "%ROOT%\tools\portable\Lancer.cmd" "%DIST%\Lancer.cmd" >nul

if exist "%ROOT%\SoftTunes-dist" rmdir /S /Q "%ROOT%\SoftTunes-dist"
mkdir "%ROOT%\SoftTunes-dist"
xcopy /E /I /Y "%DIST%\*" "%ROOT%\SoftTunes-dist\" >nul

copy /Y "%ROOT%\SoftTunes-dist\SoftTunes.exe" "%ROOT%\SoftTunes.exe" >nul
if exist "%ROOT%\_internal" rmdir /S /Q "%ROOT%\_internal"
xcopy /E /I /Y "%ROOT%\SoftTunes-dist\_internal" "%ROOT%\_internal\" >nul

echo.
echo OK onedir: %DIST%
echo OK SoftTunes-dist: %ROOT%\SoftTunes-dist
echo Run: SoftTunes-dist\SoftTunes.exe
exit /b 0
