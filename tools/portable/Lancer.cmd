:: Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
:: SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
:: Author: Mr-Aurevo-X

@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "%~dp0Opti.exe" (
  echo Opti.exe introuvable. Ce dossier doit contenir Opti.exe et _internal.
  pause
  exit /b 1
)
if not exist "%~dp0_internal\" (
  echo [ERREUR] Dossier _internal manquant. Ne deplacez jamais Opti.exe seul.
  pause
  exit /b 1
)
start "" "%~dp0Opti.exe"
