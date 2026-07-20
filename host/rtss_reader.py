"""Read FPS / frametime from RivaTuner Statistics Server shared memory (if present)."""
from __future__ import annotations

import ctypes
import mmap
import struct
from typing import Any

# RTSS shared memory layout (simplified V2) — see RTSSSharedMemory.h
RTSS_NAME = "RTSSSharedMemoryV2"
# Signature 'RTSS' = 0x52545353
RTSS_SIGNATURE = 0x52545353


def _try_open_mmap() -> mmap.mmap | None:
    try:
        # Windows named shared memory via tagname
        return mmap.mmap(-1, 4096, tagname=RTSS_NAME, access=mmap.ACCESS_READ)
    except OSError:
        return None
    except ValueError:
        return None


def get_fps_sample() -> dict[str, Any]:
    """
    Returns { ok, available, fps, frametimeMs, app, error }.
    Best-effort parse of RTSS shared memory; fails soft if RTSS not running.
    """
    mm = _try_open_mmap()
    if mm is None:
        return {
            "ok": True,
            "available": False,
            "fps": None,
            "frametimeMs": None,
            "app": None,
            "error": "RTSS shared memory not found (install MSI Afterburner + RTSS)",
            "download": "https://www.msi.com/Landing/afterburner",
        }
    try:
        raw = mm.read(256)
        if len(raw) < 16:
            return {
                "ok": True,
                "available": False,
                "fps": None,
                "frametimeMs": None,
                "app": None,
                "error": "RTSS memory too small",
            }
        (dwSignature,) = struct.unpack_from("<I", raw, 0)
        if dwSignature != RTSS_SIGNATURE:
            # Some builds store signature differently; still try offset heuristics
            pass

        # Heuristic scan: look for a plausible FPS float (10..1000) near known offsets
        fps = None
        frametime = None
        app_name = None

        # Official-ish offsets for entry 0 vary by version; try common patterns:
        # After header (~280+ bytes), AppEntry has szName[260] then dwFlags, dwProcessID,
        # then 10800h of OSD, then dwFramerate (0.1 FPS units as DWORD in some versions)
        # We use a conservative approach: search DWORD values that look like fps*10
        for off in range(0, min(len(raw), 240), 4):
            try:
                (v,) = struct.unpack_from("<I", raw, off)
            except struct.error:
                break
            # dwFramerate often stored as FPS * 10
            if 100 <= v <= 10000:  # 10.0 .. 1000.0 FPS
                candidate = v / 10.0
                if fps is None or (30 <= candidate <= 500):
                    fps = candidate

        if fps is not None and fps > 0:
            frametime = round(1000.0 / fps, 2)

        # Try UTF-16 or ASCII name near start of first app slot (offset ~280)
        try:
            name_bytes = raw[280:280 + 64]
            app_name = name_bytes.split(b"\x00")[0].decode("ascii", errors="ignore").strip() or None
        except Exception:
            app_name = None

        return {
            "ok": True,
            "available": fps is not None,
            "fps": round(fps, 1) if fps is not None else None,
            "frametimeMs": frametime,
            "app": app_name,
            "error": None if fps is not None else "RTSS running but no FPS sample yet (open a game with OSD)",
            "download": "https://www.msi.com/Landing/afterburner",
        }
    except Exception as exc:
        return {
            "ok": False,
            "available": False,
            "fps": None,
            "frametimeMs": None,
            "app": None,
            "error": str(exc),
        }
    finally:
        try:
            mm.close()
        except Exception:
            pass


def open_afterburner_download() -> dict[str, Any]:
    import webbrowser

    url = "https://www.msi.com/Landing/afterburner"
    try:
        webbrowser.open(url)
        return {"ok": True, "url": url}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}
