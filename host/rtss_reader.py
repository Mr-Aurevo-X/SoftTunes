"""Read FPS / frametime from RivaTuner Statistics Server shared memory (RTSSSharedMemoryV2)."""
from __future__ import annotations

import ctypes
import struct
from typing import Any

RTSS_NAME = "RTSSSharedMemoryV2"
RTSS_SIGNATURE = 0x52545353  # 'RTSS'
RTSS_SIGNATURE_INV = 0xADABACAC  # ~'RTSS' while RTSS is shutting down
APPFLAG_ACTIVE = 0x00000001
NAME_LEN = 260
DOWNLOAD = "https://www.msi.com/Landing/afterburner"
FILE_MAP_READ = 0x0004

kernel32 = ctypes.windll.kernel32


def _empty(error: str | None, available: bool = False) -> dict[str, Any]:
    return {
        "ok": True,
        "available": available,
        "fps": None,
        "frametimeMs": None,
        "onePercentLow": None,
        "app": None,
        "error": error,
        "download": DOWNLOAD,
    }


def _decode_name(raw: bytes) -> str | None:
    if not raw:
        return None
    try:
        text = raw.split(b"\x00", 1)[0].decode("ascii", errors="ignore").strip()
        return text or None
    except Exception:
        return None


def _open_rtss_view() -> tuple[int, int] | None:
    """Open existing RTSS mapping only (do not CreateFileMapping). Returns (view_addr, handle)."""
    handle = kernel32.OpenFileMappingW(FILE_MAP_READ, False, RTSS_NAME)
    if not handle:
        return None
    addr = kernel32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0)
    if not addr:
        kernel32.CloseHandle(handle)
        return None
    return int(addr), int(handle)


def _close_rtss_view(addr: int, handle: int) -> None:
    try:
        kernel32.UnmapViewOfFile(ctypes.c_void_p(addr))
    except Exception:
        pass
    try:
        kernel32.CloseHandle(handle)
    except Exception:
        pass


def _read(addr: int, offset: int, size: int) -> bytes:
    buf = (ctypes.c_char * size).from_address(addr + offset)
    return bytes(buf)


def get_fps_sample() -> dict[str, Any]:
    """
    Parse RTSS shared memory header + app array via OpenFileMapping.
    FPS from dwFrameTime (microseconds): fps = 1e6 / dwFrameTime.
    """
    opened = _open_rtss_view()
    if opened is None:
        return _empty("RTSS shared memory not found (install MSI Afterburner + RTSS)")

    addr, handle = opened
    try:
        header = _read(addr, 0, 32)
        if len(header) < 20:
            return _empty("RTSS memory too small")

        dw_signature, dw_version, app_entry_size, app_arr_offset, app_arr_size = struct.unpack_from(
            "<IIIII", header, 0
        )
        if dw_signature == RTSS_SIGNATURE_INV:
            return _empty("RTSS is shutting down")
        if dw_signature != RTSS_SIGNATURE:
            return _empty(
                f"RTSS signature mismatch (got 0x{dw_signature:08X}, unsupported build)"
            )

        if app_entry_size < (NAME_LEN + 28) or app_arr_size <= 0 or app_arr_offset < 20:
            return _empty("RTSS header invalid")

        best: dict[str, Any] | None = None
        for i in range(min(int(app_arr_size), 256)):
            off = int(app_arr_offset) + i * int(app_entry_size)
            try:
                chunk = _read(addr, off, NAME_LEN + 28)
            except Exception:
                break
            if len(chunk) < NAME_LEN + 28:
                break

            name = _decode_name(chunk[:NAME_LEN])
            dw_flags, dw_pid, _l_refresh, _t0, _t1, _frames, dw_frame_time = struct.unpack_from(
                "<IIiiiiI", chunk, NAME_LEN
            )

            if dw_frame_time == 0 or dw_frame_time > 10_000_000:
                continue

            fps = 1_000_000.0 / float(dw_frame_time)
            if fps < 1.0 or fps > 1000.0:
                continue

            frametime_ms = round(dw_frame_time / 1000.0, 2)
            active = bool(dw_flags & APPFLAG_ACTIVE)
            candidate = {
                "fps": round(fps, 1),
                "frametimeMs": frametime_ms,
                "app": name,
                "active": active,
                "pid": int(dw_pid),
            }
            if best is None or (active and not best.get("active")):
                best = candidate
            if active:
                break

        if best is None:
            return _empty("RTSS running but no FPS sample yet (open a game with OSD)")

        return {
            "ok": True,
            "available": True,
            "fps": best["fps"],
            "frametimeMs": best["frametimeMs"],
            "onePercentLow": None,
            "app": best["app"],
            "error": None,
            "download": DOWNLOAD,
            "rtssVersion": int(dw_version),
        }
    except Exception as exc:
        return {
            "ok": False,
            "available": False,
            "fps": None,
            "frametimeMs": None,
            "onePercentLow": None,
            "app": None,
            "error": str(exc),
            "download": DOWNLOAD,
        }
    finally:
        _close_rtss_view(addr, handle)


def open_afterburner_download() -> dict[str, Any]:
    import webbrowser

    try:
        webbrowser.open(DOWNLOAD)
        return {"ok": True, "url": DOWNLOAD}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": DOWNLOAD}
