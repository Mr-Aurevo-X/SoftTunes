"""Read FPS / frametime from RivaTuner Statistics Server shared memory (RTSSSharedMemoryV2)."""
from __future__ import annotations

import ctypes
import struct
import subprocess
import threading
from typing import Any

RTSS_NAME = "RTSSSharedMemoryV2"
RTSS_SIGNATURE = 0x52545353  # 'RTSS'
RTSS_SIGNATURE_INV = 0xADABACAC
APPFLAG_ACTIVE = 0x00000001
NAME_LEN = 260
DOWNLOAD = "https://www.msi.com/Landing/afterburner"
FILE_MAP_READ = 0x0004
MAX_MAP_BYTES = 16 * 1024 * 1024

# RTSS_SHARED_MEMORY_APP_ENTRY field offsets (see RTSSSharedMemory.h)
OFF_PID = 0
OFF_NAME = 4
OFF_FLAGS = 264
OFF_TIME0 = 268
OFF_TIME1 = 272
OFF_FRAMES = 276
OFF_FRAMETIME = 280
MIN_ENTRY_SIZE = 284

_RTSS_LOCK = threading.Lock()

kernel32 = ctypes.windll.kernel32

# 64-bit: default ctypes restype truncates MapViewOfFile pointers -> access violation.
kernel32.OpenFileMappingW.restype = ctypes.c_void_p
kernel32.OpenFileMappingW.argtypes = [ctypes.c_ulong, ctypes.c_bool, ctypes.c_wchar_p]
kernel32.MapViewOfFile.restype = ctypes.c_void_p
kernel32.MapViewOfFile.argtypes = [
    ctypes.c_void_p,
    ctypes.c_ulong,
    ctypes.c_ulong,
    ctypes.c_ulong,
    ctypes.c_size_t,
]
kernel32.UnmapViewOfFile.argtypes = [ctypes.c_void_p]
kernel32.CloseHandle.argtypes = [ctypes.c_void_p]


def _view_ptr(addr: int | ctypes.c_void_p) -> int:
    if isinstance(addr, ctypes.c_void_p):
        return int(addr.value or 0)
    return int(addr)


def _empty(error: str | None, available: bool = False, **extra: Any) -> dict[str, Any]:
    out: dict[str, Any] = {
        "ok": True,
        "available": available,
        "fps": None,
        "frametimeMs": None,
        "onePercentLow": None,
        "app": None,
        "error": error,
        "download": DOWNLOAD,
    }
    out.update(extra)
    return out


def _rtss_process_running() -> bool:
    """Best-effort: RTSS.exe running (no fragile Toolhelp snapshot ctypes)."""
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq RTSS.exe", "/NH"],
            capture_output=True,
            text=True,
            timeout=3,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return "RTSS.exe" in (out.stdout or "")
    except Exception:
        return False


def _decode_name(raw: bytes) -> str | None:
    if not raw:
        return None
    try:
        text = raw.split(b"\x00", 1)[0].decode("ascii", errors="ignore").strip()
        return text or None
    except Exception:
        return None


def _open_rtss_view() -> tuple[int, int, int] | None:
    """Open RTSS mapping once. Returns (view_addr, handle, map_size)."""
    handle = kernel32.OpenFileMappingW(FILE_MAP_READ, False, RTSS_NAME)
    if not handle:
        return None
    h_ptr = _view_ptr(handle)
    addr = kernel32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0)
    if not addr:
        kernel32.CloseHandle(ctypes.c_void_p(h_ptr))
        return None
    addr_i = _view_ptr(addr)
    try:
        header = ctypes.string_at(addr_i, 32)
        if len(header) < 20:
            return None
        _sig, _ver, entry_size, arr_offset, arr_size = struct.unpack_from("<IIIII", header, 0)
        total = int(arr_offset) + int(arr_size) * int(entry_size)
        if total < 4096:
            total = 65536
        if total > MAX_MAP_BYTES:
            total = MAX_MAP_BYTES
    except Exception:
        total = 65536
    kernel32.UnmapViewOfFile(ctypes.c_void_p(addr_i))
    addr2 = kernel32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, total)
    if not addr2:
        kernel32.CloseHandle(ctypes.c_void_p(h_ptr))
        return None
    return _view_ptr(addr2), h_ptr, int(total)


def _close_rtss_view(addr: int, handle: int) -> None:
    try:
        kernel32.UnmapViewOfFile(ctypes.c_void_p(addr))
    except Exception:
        pass
    try:
        kernel32.CloseHandle(handle)
    except Exception:
        pass


def _read_at(addr: int, offset: int, size: int, map_size: int) -> bytes:
    if offset < 0 or size <= 0 or offset + size > map_size:
        raise ValueError("RTSS read out of bounds")
    return ctypes.string_at(addr + offset, size)


def _fps_from_entry(blob: bytes, entry_size: int) -> dict[str, Any] | None:
    if entry_size < MIN_ENTRY_SIZE or len(blob) < MIN_ENTRY_SIZE:
        return None
    dw_pid = struct.unpack_from("<I", blob, OFF_PID)[0]
    if dw_pid == 0:
        return None
    name = _decode_name(blob[OFF_NAME : OFF_NAME + NAME_LEN])
    dw_flags = struct.unpack_from("<I", blob, OFF_FLAGS)[0]
    dw_time0 = struct.unpack_from("<I", blob, OFF_TIME0)[0]
    dw_time1 = struct.unpack_from("<I", blob, OFF_TIME1)[0]
    dw_frames = struct.unpack_from("<I", blob, OFF_FRAMES)[0]
    dw_frame_time = struct.unpack_from("<I", blob, OFF_FRAMETIME)[0]

    fps = None
    frametime_ms = None
    if dw_time1 > dw_time0 and dw_frames > 0:
        fps = dw_frames * 1000.0 / float(dw_time1 - dw_time0)
    elif dw_frame_time > 0:
        fps = 1_000_000.0 / float(dw_frame_time)
        frametime_ms = round(dw_frame_time / 1000.0, 2)

    if fps is None or fps < 1.0 or fps > 10000.0:
        return None
    if frametime_ms is None:
        frametime_ms = round(1000.0 / fps, 2)

    return {
        "fps": round(fps, 1),
        "frametimeMs": frametime_ms,
        "app": name,
        "active": bool(dw_flags & APPFLAG_ACTIVE),
        "pid": int(dw_pid),
    }


def get_fps_sample() -> dict[str, Any]:
    """
    Parse RTSS shared memory (RTSSSharedMemoryV2).
    FPS from dwFrames/(dwTime1-dwTime0) or 1e6/dwFrameTime (µs).
    """
    with _RTSS_LOCK:
        return _get_fps_sample_unlocked()


def _get_fps_sample_unlocked() -> dict[str, Any]:
    proc = _rtss_process_running()
    opened = _open_rtss_view()
    if opened is None:
        if proc:
            return _empty(
                "RTSS lancé mais mémoire partagée inaccessible — redémarrez RTSS",
                rtssProcess=proc,
            )
        return _empty(
            "RTSS not detected — start RTSS (with Afterburner) then a game with OSD",
            rtssProcess=False,
            hintFr="Démarrer : MSI Afterburner → engrenage → RTSS au démarrage, ou lancer RTSS.exe",
            hintEn="Start MSI Afterburner → settings → run RTSS on startup, or launch RTSS.exe",
        )

    addr, handle, map_size = opened
    try:
        header = _read_at(addr, 0, 32, map_size)
        if len(header) < 20:
            return _empty("RTSS memory too small", rtssProcess=proc)

        dw_signature, dw_version, entry_size, arr_offset, arr_size = struct.unpack_from(
            "<IIIII", header, 0
        )
        if dw_signature == RTSS_SIGNATURE_INV:
            return _empty("RTSS is shutting down", rtssProcess=proc)
        if dw_signature != RTSS_SIGNATURE:
            return _empty(
                f"RTSS signature mismatch (0x{dw_signature:08X})",
                rtssProcess=proc,
            )

        if entry_size < MIN_ENTRY_SIZE or arr_size <= 0 or arr_offset < 20:
            return _empty("RTSS header invalid", rtssProcess=proc)

        best: dict[str, Any] | None = None
        for i in range(min(int(arr_size), 256)):
            off = int(arr_offset) + i * int(entry_size)
            try:
                chunk = _read_at(addr, off, int(entry_size), map_size)
            except Exception:
                break
            cand = _fps_from_entry(chunk, int(entry_size))
            if not cand:
                continue
            if cand.get("active"):
                best = cand
                break
            if best is None or cand["fps"] > best["fps"]:
                best = cand

        if best is None:
            return _empty(
                "RTSS running — start a game with Afterburner OSD (Shift+F12)",
                rtssProcess=True,
                rtssConnected=True,
                hintFr="L'OSD doit être visible en jeu (Afterburner → Surveillance → OSD activé).",
                hintEn="OSD must show in-game (Afterburner → Monitoring → OSD on).",
            )

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
            "rtssProcess": proc,
            "rtssConnected": True,
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
            "rtssProcess": proc,
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
