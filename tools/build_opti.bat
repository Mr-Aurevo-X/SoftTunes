@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DISTEXE=%ROOT%\dist\SoftTunes.exe

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

if not exist "%DISTEXE%" (
  echo Build failed — expected onefile %DISTEXE%
  exit /b 1
)

if exist "%ROOT%\SoftTunes-dist" rmdir /S /Q "%ROOT%\SoftTunes-dist"
mkdir "%ROOT%\SoftTunes-dist"
copy /Y "%DISTEXE%" "%ROOT%\SoftTunes-dist\SoftTunes.exe" >nul
copy /Y "%ROOT%\host\SoftTunes.exe.config" "%ROOT%\SoftTunes-dist\SoftTunes.exe.config" >nul
copy /Y "%ROOT%\version.json" "%ROOT%\SoftTunes-dist\version.json" >nul
copy /Y "%DISTEXE%" "%ROOT%\SoftTunes.exe" >nul

echo.
echo OK onefile: %DISTEXE%
echo OK SoftTunes-dist: %ROOT%\SoftTunes-dist\SoftTunes.exe
exit /b 0
