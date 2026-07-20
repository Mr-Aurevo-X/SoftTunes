# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\host\\opti_host.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\ui\\index.html', 'ui'), ('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\ui\\styles.css', 'ui'), ('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\ui\\app.js', 'ui'), ('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\ui\\suite-boot.js', 'ui'), ('C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\ui\\brand-icon.png', 'ui')],
    hiddenimports=['clr'],
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
    name='Opti',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['C:\\Users\\aurel\\Desktop\\Suite Mr-Aurevo-X\\Opti\\brand-icon.ico'],
)
