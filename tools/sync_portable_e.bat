@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set ROOT=%CD%
set DEST=E:\Mr-Aurevo-X Dev\Opti
set PREREQ=E:\Mr-Aurevo-X Dev\_prereq-cache

if not exist "%ROOT%\Opti-dist\Opti.exe" (
  echo Build first: tools\build_opti.bat
  exit /b 1
)

if not exist "E:\Mr-Aurevo-X Dev" (
  echo [ERREUR] E:\Mr-Aurevo-X Dev introuvable
  exit /b 1
)

if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%"

rem Full onedir at root of Opti\ so Opti.exe sits next to _internal
xcopy /E /I /Y "%ROOT%\Opti-dist\*" "%DEST%\" >nul

if exist "%ROOT%\OptiSetup.exe" copy /Y "%ROOT%\OptiSetup.exe" "%DEST%\OptiSetup.exe" >nul
if exist "%ROOT%\README.md" copy /Y "%ROOT%\README.md" "%DEST%\README.md" >nul
if exist "%ROOT%\version.json" copy /Y "%ROOT%\version.json" "%DEST%\version.json" >nul
if exist "%ROOT%\logo-opti.ico" copy /Y "%ROOT%\logo-opti.ico" "%DEST%\logo-opti.ico" >nul

mkdir "%DEST%\prereqs" 2>nul
if exist "%PREREQ%\MicrosoftEdgeWebview2Setup.exe" (
  copy /Y "%PREREQ%\MicrosoftEdgeWebview2Setup.exe" "%DEST%\prereqs\MicrosoftEdgeWebview2Setup.exe" >nul
)
if exist "%PREREQ%\VC_redist.x64.exe" (
  copy /Y "%PREREQ%\VC_redist.x64.exe" "%DEST%\prereqs\VC_redist.x64.exe" >nul
)

copy /Y "%ROOT%\tools\portable\Lancer.cmd" "%DEST%\Lancer.cmd" >nul
copy /Y "%ROOT%\tools\portable\Installer.cmd" "%DEST%\Installer.cmd" >nul
copy /Y "%ROOT%\tools\portable\Uninstall.cmd" "%DEST%\Uninstall.cmd" >nul
copy /Y "%ROOT%\tools\portable\LIREMOI.txt" "%DEST%\LIREMOI.txt" >nul
copy /Y "%ROOT%\tools\portable\Install-Prereqs.cmd" "%DEST%\Install-Prereqs.cmd" >nul

echo OK portable: %DEST%
echo Launch: %DEST%\Opti.exe  or  %DEST%\Lancer.cmd
exit /b 0
