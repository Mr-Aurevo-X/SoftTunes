# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""OptiSetup — install Opti onedir package to LocalAppData + shortcuts (no admin required)."""
from __future__ import annotations

import os
import shutil
import sys
import winreg
from pathlib import Path


APP_NAME = "Opti"
PUBLISHER = "Mr-Aurevo-X"
VERSION = "1.6.0"


def bundle_dir() -> Path:
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
        here = Path(sys.executable).resolve().parent
        for cand in (
            meipass / "Opti-dist",
            here / "Opti-dist",
            here / "Opti",
            meipass,
            here,
        ):
            if (cand / "Opti.exe").is_file():
                return cand
        return here
    root = Path(__file__).resolve().parent.parent
    for cand in (root / "dist" / "Opti", root / "Opti-dist", root):
        if (cand / "Opti.exe").is_file():
            return cand
    return root


def install_root() -> Path:
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local) / "Programs" / "OptiBy-Mr-Aurevo-X"


def create_shortcut(lnk_path: Path, target: Path, workdir: Path, icon: Path | None = None) -> None:
    try:
        import win32com.client  # type: ignore
        shell = win32com.client.Dispatch("WScript.Shell")
        sc = shell.CreateShortCut(str(lnk_path))
        sc.Targetpath = str(target)
        sc.WorkingDirectory = str(workdir)
        sc.IconLocation = str(icon or target)
        sc.Description = "Opti — Optimiseur PC gaming (indépendant, gratuit)"
        sc.save()
        return
    except Exception:
        pass
    # Fallback via PowerShell COM
    ico = str(icon or target).replace("'", "''")
    tgt = str(target).replace("'", "''")
    wd = str(workdir).replace("'", "''")
    lnk = str(lnk_path).replace("'", "''")
    ps = (
        f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
        f"$s.TargetPath='{tgt}';$s.WorkingDirectory='{wd}';"
        f"$s.IconLocation='{ico}';$s.Description='Opti';$s.Save()"
    )
    os.system(f'powershell -NoProfile -ExecutionPolicy Bypass -Command "{ps}"')


def write_uninstall(dest: Path, exe: Path) -> None:
    uninst = dest / "Uninstall-Opti.ps1"
    uninst.write_text(
        f"""# Uninstall Opti (user-level)
$ErrorActionPreference = 'SilentlyContinue'
$dest = '{dest}'
$desktop = [Environment]::GetFolderPath('Desktop')
$start = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Opti'
Remove-Item (Join-Path $desktop 'Opti.lnk') -Force
Remove-Item (Join-Path $start 'Opti.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item $start -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Opti' -Recurse -Force
Remove-Item -LiteralPath $dest -Recurse -Force
""",
        encoding="utf-8",
    )
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Opti"
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

    # Copy portable payload
    if (src / "Opti.exe").is_file():
        for item in src.iterdir():
            target = dest / item.name
            if item.is_dir():
                shutil.copytree(item, target, dirs_exist_ok=True)
            else:
                shutil.copy2(item, target)
    else:
        # Dev fallback: copy project runtime pieces + run via python later
        for name in ("ui", "api", "modules", "lists", "host", "requirements.txt", "logo-opti.ico"):
            p = src / name
            if p.is_dir():
                shutil.copytree(p, dest / name, dirs_exist_ok=True)
            elif p.is_file():
                shutil.copy2(p, dest / name)
        print("WARNING: Opti.exe missing — copied sources only. Build first.")

    exe = dest / "Opti.exe"
    if not exe.is_file():
        print("ERROR: Opti.exe not found after copy. Run tools\\build_opti.bat first.")
        return 1

    desktop = Path(os.path.join(os.path.expanduser("~"), "Desktop"))
    start_dir = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Opti"
    start_dir.mkdir(parents=True, exist_ok=True)
    icon = dest / "logo-opti.ico"
    if not icon.is_file():
        icon = exe
    create_shortcut(desktop / "Opti.lnk", exe, dest, icon)
    create_shortcut(start_dir / "Opti.lnk", exe, dest, icon)
    write_uninstall(dest, exe)

    print("OK — Opti installed.")
    print(f"Launch: {exe}")
    try:
        os.startfile(str(exe))  # type: ignore[attr-defined]
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
