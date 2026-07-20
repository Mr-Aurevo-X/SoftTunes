@echo off
cd /d "%~dp0.."
set ROOT=%CD%
set DESK=%USERPROFILE%\Desktop\Opti Mr-Aurevo-X

if not exist "%ROOT%\Opti-dist\Opti.exe" (
  echo Build first: tools\build_opti.bat
  exit /b 1
)
if not exist "%ROOT%\OptiSetup.exe" (
  echo Build setup first: tools\build_setup.bat
  exit /b 1
)

if not exist "%DESK%" mkdir "%DESK%"

rem Never place a lone Opti.exe at Desktop root (needs _internal).
if exist "%DESK%\Opti.exe" del /F /Q "%DESK%\Opti.exe"

if exist "%DESK%\Opti" rmdir /S /Q "%DESK%\Opti"
if exist "%DESK%\Opti-dist" rmdir /S /Q "%DESK%\Opti-dist"
xcopy /E /I /Y "%ROOT%\Opti-dist" "%DESK%\Opti\" >nul
xcopy /E /I /Y "%ROOT%\Opti-dist" "%DESK%\Opti-dist\" >nul
copy /Y "%ROOT%\OptiSetup.exe" "%DESK%\OptiSetup.exe" >nul
copy /Y "%ROOT%\README.md" "%DESK%\README.md" >nul
if exist "%ROOT%\version.json" copy /Y "%ROOT%\version.json" "%DESK%\version.json" >nul

echo OK Desktop: %DESK%
echo Launch: %DESK%\Opti\Opti.exe  or  %DESK%\OptiSetup.exe
exit /b 0
