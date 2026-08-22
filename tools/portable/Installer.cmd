@echo off
setlocal
echo.
echo  SoftTunes portable installer
echo  Target:
echo    %LOCALAPPDATA%\Programs\SoftTunes
echo.
set "DEST=%LOCALAPPDATA%\Programs\SoftTunes"
set "SRC=%~dp0.."
if not exist "%SRC%\SoftTunes.exe" if not exist "%SRC%\Opti.exe" (
  echo ERROR: SoftTunes.exe not found next to tools\portable
  exit /b 1
)
if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%" 2>nul
xcopy /E /I /Y "%SRC%\*" "%DEST%\" >nul
echo OK installed to %DEST%
echo Launch: %DEST%\SoftTunes.exe
if exist "%DEST%\SoftTunes.exe" (
  start "" "%DEST%\SoftTunes.exe"
) else (
  start "" "%DEST%\Opti.exe"
)
exit /b 0
