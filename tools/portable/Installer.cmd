:: Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
:: SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
:: Author: Mr-Aurevo-X

@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Opti — Installation Mr-Aurevo-X
echo.
echo  ========================================
echo   Opti — Installation sur ce PC
echo  ========================================
echo.
echo  Copie vers :
echo    %LOCALAPPDATA%\Programs\Opti
echo  + raccourcis Bureau et menu Demarrer
echo.

set "DEST=%LOCALAPPDATA%\Programs\Opti"
if not exist "%~dp0Opti.exe" (
  echo [ERREUR] Opti.exe introuvable a cote de Installer.cmd
  pause
  exit /b 1
)
if not exist "%~dp0_internal\" (
  echo [ERREUR] _internal manquant — paquet portable incomplete.
  pause
  exit /b 1
)

if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%" 2>nul
xcopy /E /I /Y "%~dp0*" "%DEST%\" >nul

rem Ne pas recopier les scripts d'install dans le dossier installé comme "source"
rem (ils restent utiles sur place)

set "SC=%TEMP%\opti_shortcut.vbs"
> "%SC%" echo Set o = CreateObject("WScript.Shell")
>>"%SC%" echo Dim d, p
>>"%SC%" echo d = o.SpecialFolders("Desktop")
>>"%SC%" echo Set s = o.CreateShortcut(d ^& "\Opti Mr-Aurevo-X.lnk")
>>"%SC%" echo s.TargetPath = "%DEST%\Opti.exe"
>>"%SC%" echo s.WorkingDirectory = "%DEST%"
>>"%SC%" echo s.Description = "Opti — Optimiseur PC gaming Mr-Aurevo-X"
>>"%SC%" echo If CreateObject("Scripting.FileSystemObject").FileExists("%DEST%\logo-opti.ico") Then s.IconLocation = "%DEST%\logo-opti.ico"
>>"%SC%" echo s.Save
>>"%SC%" echo p = o.SpecialFolders("StartMenu") ^& "\Programs"
>>"%SC%" echo On Error Resume Next
>>"%SC%" echo CreateObject("Scripting.FileSystemObject").CreateFolder p ^& "\Mr-Aurevo-X"
>>"%SC%" echo On Error Goto 0
>>"%SC%" echo Set s2 = o.CreateShortcut(p ^& "\Mr-Aurevo-X\Opti.lnk")
>>"%SC%" echo s2.TargetPath = "%DEST%\Opti.exe"
>>"%SC%" echo s2.WorkingDirectory = "%DEST%"
>>"%SC%" echo If CreateObject("Scripting.FileSystemObject").FileExists("%DEST%\logo-opti.ico") Then s2.IconLocation = "%DEST%\logo-opti.ico"
>>"%SC%" echo s2.Save
cscript //nologo "%SC%"
del "%SC%" >nul 2>&1

echo.
echo  [OK] Installation terminee.
echo  Emplacement : %DEST%
echo  Preferez aussi OptiSetup.exe si vous voulez le setup officiel.
echo.
pause
start "" "%DEST%\Opti.exe"
