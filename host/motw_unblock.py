# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""Strip Windows Mark of the Web so pythonnet can load Python.Runtime.dll."""
from __future__ import annotations

import ctypes
import os
import sys
from pathlib import Path

_NATIVE_EXTS = {".dll", ".exe", ".pyd"}


def _remove_zone_identifier(path: Path) -> None:
    ads = f"{path}:Zone.Identifier"
    try:
        if sys.platform == "win32":
            ctypes.windll.kernel32.DeleteFileW(ads)
        else:
            os.remove(ads)
    except OSError:
        pass


def strip_bundle_motw() -> None:
    """Clear Zone.Identifier on frozen exe + _internal + sibling runtime dirs."""
    if sys.platform != "win32" or not getattr(sys, "frozen", False):
        return
    roots: list[Path] = []
    meipass = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    roots.append(meipass)
    roots.append(Path(sys.executable).resolve().parent)
    seen: set[str] = set()
    for root in roots:
        key = str(root.resolve()) if root.exists() else ""
        if not key or key in seen:
            continue
        seen.add(key)
        for dirpath, _dirs, filenames in os.walk(root):
            for name in filenames:
                if Path(name).suffix.lower() not in _NATIVE_EXTS:
                    continue
                _remove_zone_identifier(Path(dirpath) / name)
