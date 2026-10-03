# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

spec_dir = Path(SPECPATH).resolve()
root = spec_dir.parent
ui_stage = root / "build" / "ui_stage"
tools_bin = root / "tools" / "bin"

datas = []
if ui_stage.is_dir():
    datas.append((str(ui_stage), "ui"))
for folder, dest in (("api", "api"), ("modules", "modules"), ("lists", "lists")):
    src = root / folder
    if src.is_dir():
        datas.append((str(src), dest))
if tools_bin.is_dir():
    datas.append((str(tools_bin), "bin"))
if (root / "version.json").is_file():
    datas.append((str(root / "version.json"), "."))
crypto_json = spec_dir / "crypto_donations.json"
if crypto_json.is_file():
    datas.append((str(crypto_json), "."))

binaries = []
hiddenimports = [
    "clr",
    "fps_worker",
    "presentmon_reader",
    "fps_worker_manager",
    "fps_overlay",
    "system_stats",
    "window_chrome",
    "confirm_gate",
    "motw_unblock",
    "hub_update",
]
for pkg in ("webview", "pythonnet", "clr_loader"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

a = Analysis(
    [str(spec_dir / "opti_host.py")],
    pathex=[str(spec_dir)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[str(spec_dir / "pyi_rth_motw_unblock.py")],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SoftTunes",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=True,
    version=str(root / "tools" / "file_version_info.txt"),
    icon=[str(root / "logo-opti.ico")],
)
