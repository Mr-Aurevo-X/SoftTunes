@echo off
setlocal
echo.
echo  SoftTunes portable installer
echo  Target:
echo    %LOCALAPPDATA%\Programs\SoftTunes
echo.
set "DEST=%LOCALAPPDATA%\Programs\SoftTunes"
set "SRC=%~dp0.."
if not exist "%SRC%\Opti.exe" if not exist "%SRC%\SoftTunes.exe" (
  echo ERROR: SoftTunes / Opti.exe not found next to tools\portable
  exit /b 1
)
if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%" 2>nul
xcopy /E /I /Y "%SRC%\*" "%DEST%\" >nul
echo OK installed to %DEST%
echo Launch: %DEST%\Opti.exe  (or SoftTunes.exe if present)
start "" "%DEST%\Opti.exe" 2>nul
if errorlevel 1 start "" "%DEST%\SoftTunes.exe" 2>nul
exit /b 0
