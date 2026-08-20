@echo off
setlocal
echo.
echo  SoftTunes uninstall
echo  Removing:
echo    %LOCALAPPDATA%\Programs\SoftTunes
echo    (legacy) %LOCALAPPDATA%\Programs\OptiBy-Mr-Aurevo-X
echo    (legacy) %LOCALAPPDATA%\Programs\Opti
echo.
set "DEST=%LOCALAPPDATA%\Programs\SoftTunes"
if exist "%DEST%" rmdir /S /Q "%DEST%"
if exist "%LOCALAPPDATA%\Programs\OptiBy-Mr-Aurevo-X" rmdir /S /Q "%LOCALAPPDATA%\Programs\OptiBy-Mr-Aurevo-X"
if exist "%LOCALAPPDATA%\Programs\Opti" rmdir /S /Q "%LOCALAPPDATA%\Programs\Opti"
del /Q "%USERPROFILE%\Desktop\SoftTunes.lnk" 2>nul
del /Q "%USERPROFILE%\Desktop\Opti.lnk" 2>nul
echo Done.
exit /b 0
