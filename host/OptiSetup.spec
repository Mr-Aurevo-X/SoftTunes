# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\aurel\\Documents\\Dev Central Tree\\Opti\\host\\opti_setup.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\aurel\\Documents\\Dev Central Tree\\Opti\\Opti-dist', 'Opti-dist')],
    hiddenimports=[],
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
    a.binaries,
    a.datas,
    [],
    name='OptiSetup',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='C:\\Users\\aurel\\Documents\\Dev Central Tree\\Opti\\tools\\file_version_info.txt',
    icon=['C:\\Users\\aurel\\Documents\\Dev Central Tree\\Opti\\logo-opti.ico'],
)
