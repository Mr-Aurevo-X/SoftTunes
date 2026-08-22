# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all

spec_dir = Path(SPECPATH).resolve()
root = spec_dir.parent
ui_stage = root / "build" / "ui_stage"

datas = [(str(ui_stage), "ui")] if ui_stage.is_dir() else []
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
    [],
    exclude_binaries=True,
    name="SoftTunes",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version=str(root / "tools" / "file_version_info.txt"),
    icon=[str(root / "logo-opti.ico")],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="SoftTunes",
)
