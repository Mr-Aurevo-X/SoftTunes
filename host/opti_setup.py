# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""SoftTunes setup — install onedir package to LocalAppData + shortcuts (no admin required)."""
from __future__ import annotations

import os
import shutil
import sys
import winreg
from pathlib import Path


APP_NAME = "SoftTunes"
PUBLISHER = "Mr-Aurevo-X"
VERSION = "1.7.1"
INSTALL_FOLDER = "SoftTunes"
EXE_NAME = "SoftTunes.exe"
LEGACY_EXE_NAMES = ("Opti.exe",)


def bundle_dir() -> Path:
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
        here = Path(sys.executable).resolve().parent
        for cand in (
            meipass / "Opti-dist",
            meipass / "SoftTunes-dist",
            here / "Opti-dist",
            here / "SoftTunes",
            here / "Opti",
            meipass,
            here,
        ):
            if (cand / EXE_NAME).is_file() or any((cand / n).is_file() for n in LEGACY_EXE_NAMES):
                return cand
        return here
    root = Path(__file__).resolve().parent.parent
    for cand in (root / "dist" / "SoftTunes", root / "dist" / "Opti", root / "SoftTunes-dist", root / "Opti-dist", root):
        if (cand / EXE_NAME).is_file() or any((cand / n).is_file() for n in LEGACY_EXE_NAMES):
            return cand
    return root


def resolve_exe(dest: Path) -> Path:
    for name in (EXE_NAME, *LEGACY_EXE_NAMES):
        p = dest / name
        if p.is_file():
            return p
    return dest / EXE_NAME


def install_root() -> Path:
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local) / "Programs" / INSTALL_FOLDER


def create_shortcut(lnk_path: Path, target: Path, workdir: Path, icon: Path | None = None) -> None:
    try:
        import win32com.client  # type: ignore
        shell = win32com.client.Dispatch("WScript.Shell")
        sc = shell.CreateShortCut(str(lnk_path))
        sc.Targetpath = str(target)
        sc.WorkingDirectory = str(workdir)
        sc.IconLocation = str(icon or target)
        sc.Description = "SoftTunes — prepare Windows for play · FPS meter"
        sc.save()
        return
    except Exception:
        pass
    ico = str(icon or target).replace("'", "''")
    tgt = str(target).replace("'", "''")
    wd = str(workdir).replace("'", "''")
    lnk = str(lnk_path).replace("'", "''")
    ps = (
        f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
        f"$s.TargetPath='{tgt}';$s.WorkingDirectory='{wd}';"
        f"$s.IconLocation='{ico}';$s.Description='SoftTunes';$s.Save()"
    )
    os.system(f'powershell -NoProfile -ExecutionPolicy Bypass -Command "{ps}"')


def write_uninstall(dest: Path, exe: Path) -> None:
    uninst = dest / "Uninstall-SoftTunes.ps1"
    uninst.write_text(
        f"""# Uninstall SoftTunes (user-level)
$ErrorActionPreference = 'SilentlyContinue'
$dest = '{dest}'
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\SoftTunes'
Remove-Item (Join-Path $desktop 'SoftTunes.lnk') -Force
Remove-Item (Join-Path $desktop 'Opti.lnk') -Force
Remove-Item (Join-Path $start 'SoftTunes.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item $start -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\SoftTunes' -Recurse -Force
Remove-Item 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Opti' -Recurse -Force
Remove-Item -LiteralPath $dest -Recurse -Force
""",
        encoding="utf-8",
    )
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\SoftTunes"
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, key_path) as key:
        winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, f"{APP_NAME} ({PUBLISHER})")
        winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, VERSION)
        winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, PUBLISHER)
        winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, str(dest))
        winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, str(exe))
        winreg.SetValueEx(
            key,
            "UninstallString",
            0,
            winreg.REG_SZ,
            f'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{uninst}"',
        )


def main() -> int:
    src = bundle_dir()
    dest = install_root()
    print(f"Source: {src}")
    print(f"Install: {dest}")

    if dest.exists():
        shutil.rmtree(dest, ignore_errors=True)
    dest.mkdir(parents=True, exist_ok=True)

    exe_src = resolve_exe(src)
    if exe_src.is_file():
        for item in src.iterdir():
            target = dest / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)
    else:
        for name in ("ui", "api", "modules", "lists", "host", "requirements.txt", "logo-opti.ico"):
            p = src / name
            if p.is_dir():
                shutil.copytree(p, dest / name, dirs_exist_ok=True)
            elif p.is_file():
                shutil.copy2(p, dest / name)
        print("WARNING: exe missing — copied sources only. Build first.")

    exe = resolve_exe(dest)
    if not exe.is_file():
        print(f"ERROR: {EXE_NAME} not found after copy. Run tools\\build_opti.bat first.")
        return 1

    desktop = Path(os.path.join(os.path.expanduser("~"), "Desktop"))
    start_dir = (
        Path(os.environ.get("APPDATA", ""))
        / "Microsoft"
        / "Windows"
        / "Start Menu"
        / "Programs"
        / "SoftTunes"
    )
    start_dir.mkdir(parents=True, exist_ok=True)
    icon = dest / "logo-opti.ico"
    if not icon.is_file():
        icon = exe
    create_shortcut(desktop / "SoftTunes.lnk", exe, dest, icon)
    create_shortcut(start_dir / "SoftTunes.lnk", exe, dest, icon)
    write_uninstall(dest, exe)

    print("OK — SoftTunes installed.")
    print(f"Launch: {exe}")
    try:
        os.startfile(str(exe))  # type: ignore[attr-defined]
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
