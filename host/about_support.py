# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""SoftTunes About helpers — support URLs, update opt-out, labeled local paths (hub contract)."""
from __future__ import annotations

import hub_update

import json
import os
import sys
import urllib.parse
from pathlib import Path
from typing import Any

SUPPORT_URLS: dict[str, str] = {
    "discord": "https://discord.com/users/406891052516114442",
}
_ALLOWED_SUPPORT_HOSTS = frozenset({"discord.com"})

SOFT_TUNES_REPO = "https://github.com/Mr-Aurevo-X/SoftTunes"
SOFT_TUNES_INSTALL_DIR = "SoftTunes"
SOFT_TUNES_DATA_DIR = "SoftTunes"
HUB_SETTINGS_DIR = "Mr-Aurevo-X"


def localappdata_root() -> Path:
    return Path(os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local"))


def user_settings_path() -> Path:
    return localappdata_root() / HUB_SETTINGS_DIR / "user-settings.json"


def softtunes_data_dir() -> Path:
    return localappdata_root() / SOFT_TUNES_DATA_DIR


def softtunes_install_dir() -> Path:
    return localappdata_root() / "Programs" / SOFT_TUNES_INSTALL_DIR


def _user_desktop_dirs() -> list[Path]:
    home = Path.home()
    out: list[Path] = []
    for rel in (
        "Desktop",
        "Bureau",
        "OneDrive/Desktop",
        "OneDrive/Bureau",
        "OneDrive - Personal/Desktop",
        "OneDrive - Personal/Bureau",
    ):
        p = home / Path(rel)
        if p.is_dir():
            out.append(p)
    return out


def resolve_softtunes_exe_dir() -> Path | None:
    """Folder containing SoftTunes.exe when known — never monorepo/clone.

    Frozen: parent of the running exe (Desktop, USB, …).
    """
    if getattr(sys, "frozen", False):
        try:
            return Path(sys.executable).resolve().parent
        except OSError:
            return None

    exe_name = f"{SOFT_TUNES_INSTALL_DIR}.exe"
    local = localappdata_root()
    search_roots: list[Path] = list(_user_desktop_dirs())
    for name in ("Downloads", "Téléchargements", "Telechargements"):
        p = Path.home() / name
        if p.is_dir():
            search_roots.append(p)
            break
    search_roots.extend(
        [
            softtunes_install_dir(),
            local / "Programs",
            local / SOFT_TUNES_INSTALL_DIR,
        ]
    )
    seen: set[Path] = set()
    for root in search_roots:
        try:
            root = root.resolve()
        except OSError:
            continue
        if root in seen:
            continue
        seen.add(root)
        direct = root / exe_name
        if direct.is_file():
            return root
        if not root.is_dir():
            continue
        try:
            for child in root.iterdir():
                if child.is_dir() and (child / exe_name).is_file():
                    return child.resolve()
        except OSError:
            continue
    return None


def read_user_settings() -> dict[str, Any]:
    path = user_settings_path()
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def write_user_settings_merge(patch: dict[str, Any]) -> dict[str, Any]:
    current = read_user_settings()
    current.update(patch or {})
    path = user_settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return current


def is_github_update_check_enabled() -> bool:
    val = read_user_settings().get("checkGithubUpdates")
    if val is None:
        return True
    return bool(val)


def set_github_update_check(enabled: bool) -> dict[str, Any]:
    write_user_settings_merge({"checkGithubUpdates": bool(enabled)})
    return {
        "ok": True,
        "checkGithubUpdates": bool(enabled),
        "path": str(user_settings_path()),
    }


def set_suite_language(language: str) -> dict[str, Any]:
    lang = str(language or "").strip().lower()
    if lang not in ("fr", "en"):
        return {"ok": False, "error": "language must be fr or en"}
    write_user_settings_merge({"language": lang})
    return {
        "ok": True,
        "language": lang,
        "path": str(user_settings_path()),
    }


def get_update_check_pref() -> dict[str, Any]:
    return {
        "ok": True,
        "checkGithubUpdates": is_github_update_check_enabled(),
        "path": str(user_settings_path()),
        "repoUrl": SOFT_TUNES_REPO,
    }


def open_support_url(kind: str) -> dict[str, Any]:
    key = (kind or "").strip().lower()
    url = SUPPORT_URLS.get(key)
    if not url:
        return {"ok": False, "error": f"unknown support kind: {kind!r}"}
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or host not in _ALLOWED_SUPPORT_HOSTS:
        return {"ok": False, "error": "support URL rejected"}
    try:
        os.startfile(url)  # type: ignore[attr-defined]
        return {"ok": True, "kind": key, "url": url}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc), "url": url}



def list_crypto_donations() -> dict[str, Any]:
    return hub_update.list_crypto_donations()


def copy_crypto_address(asset_id: str) -> dict[str, Any]:
    return hub_update.copy_crypto_address(asset_id)


def about_local_paths(app_dir: Path | None = None) -> dict[str, Any]:
    """Labeled absolute paths for About — never expose monorepo / clone."""
    _ = app_dir
    entries: list[dict[str, Any]] = []

    exe_path: Path | None = None
    if getattr(sys, "frozen", False):
        try:
            exe_path = Path(sys.executable).resolve()
        except OSError:
            exe_path = None
    if exe_path is None:
        exe_dir = resolve_softtunes_exe_dir()
        if exe_dir is not None:
            candidate = exe_dir / f"{SOFT_TUNES_INSTALL_DIR}.exe"
            exe_path = candidate if candidate.is_file() else exe_dir

    if exe_path is not None:
        entries.append(
            {
                "id": "app",
                "label": "Install SoftTunes (exe)",
                "path": str(exe_path),
                "hint": "Fichier ou dossier de SoftTunes.exe (Bureau, USB, Downloads…) — à supprimer pour désinstaller.",
            }
        )
    else:
        # Ship location — always listed (even before first zip install / Lancer.cmd).
        entries.append(
            {
                "id": "app",
                "label": "Install SoftTunes (dossier de l’exe)",
                "path": str(softtunes_install_dir()),
                "hint": r"%LOCALAPPDATA%\Programs\SoftTunes — emplacement SoftTunes.exe (build zip).",
                "optional": True,
            }
        )

    entries.append(
        {
            "id": "data",
            "label": "Données SoftTunes",
            "path": str(softtunes_data_dir()),
            "hint": r"%LOCALAPPDATA%\SoftTunes — caches / données app.",
        }
    )
    entries.append(
        {
            "id": "settings",
            "label": "Préférences (accent, langue, vérif. maj)",
            "path": str(user_settings_path()),
            "hint": "Fichier partagé Mr-Aurevo-X — à garder si d’autres apps l’utilisent.",
        }
    )
    return {"ok": True, "paths": entries, "repoUrl": SOFT_TUNES_REPO}
