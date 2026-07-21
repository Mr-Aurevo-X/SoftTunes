# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\host\\opti_host.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\build\\ui_stage', 'ui')],
    hiddenimports=['clr', 'fps_worker', 'presentmon_reader', 'fps_worker_manager', 'fps_overlay'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
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
    name='Opti',
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
    version='C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\tools\\file_version_info.txt',
    icon=['C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\logo-opti.ico'],
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='Opti',
)
