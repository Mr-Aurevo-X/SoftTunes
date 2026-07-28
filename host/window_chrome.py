"""Frameless tool chrome helpers for pywebview (EdgeChromium / WinForms).

Drag and edge-resize go through js_api only (ReleaseCapture + WM_NCLBUTTONDOWN).
Do NOT install a Win32 WndProc NCHITTEST subclass — that path blacks out WebView2.
"""
from __future__ import annotations

import ctypes
import sys
from typing import Any

import webview

_WM_NCLBUTTONDOWN = 0x00A1
_HTCAPTION = 2
_HT_BY_EDGE = {
    "left": 10,
    "right": 11,
    "top": 12,
    "top-left": 13,
    "top-right": 14,
    "bottom": 15,
    "bottom-left": 16,
    "bottom-right": 17,
}

# Default standalone tool window geometry (sidebar ~240px + main must fit).
TOOL_WIDTH = 1320
TOOL_HEIGHT = 960
TOOL_MIN_SIZE = (1200, 780)


def window_hwnd(window: Any) -> int:
    """Resolve the WinForms HWND for a pywebview window."""
    if window is None:
        return 0
    native = getattr(window, "native", None)
    if native is None:
        return 0
    handle = getattr(native, "Handle", None)
    if handle is None:
        return 0
    try:
        return int(handle.ToInt32())
    except Exception:  # noqa: BLE001
        try:
            return int(handle)
        except Exception:  # noqa: BLE001
            return 0


def nc_drag(hwnd: int, ht: int) -> dict:
    """Synchronous caption/edge drag via ReleaseCapture + WM_NCLBUTTONDOWN."""
    if not hwnd:
        return {"ok": False, "error": "no hwnd"}
    if sys.platform != "win32":
        return {"ok": False, "error": "unsupported"}
    try:
        user32 = ctypes.windll.user32
        user32.ReleaseCapture()
        user32.SendMessageW(hwnd, _WM_NCLBUTTONDOWN, int(ht), 0)
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


class WindowChromeMixin:
    """Mixin for tool Api classes — expects self._window set via set_window / bind."""

    _window: Any = None
    _maximized: bool = False

    def set_window(self, window: Any) -> None:
        self._window = window
        self._maximized = False

    def window_minimize(self) -> dict:
        w = getattr(self, "_window", None)
        if w is None:
            return {"ok": False, "error": "no window"}
        try:
            w.minimize()
            return {"ok": True}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def window_toggle_maximize(self) -> dict:
        w = getattr(self, "_window", None)
        if w is None:
            return {"ok": False, "error": "no window"}
        try:
            if getattr(self, "_maximized", False):
                w.restore()
                self._maximized = False
            else:
                w.maximize()
                self._maximized = True
            return {"ok": True, "maximized": self._maximized}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def window_close(self) -> dict:
        w = getattr(self, "_window", None)
        if w is None:
            return {"ok": False, "error": "no window"}
        try:
            w.destroy()
            return {"ok": True}
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}

    def window_start_drag(self) -> dict:
        if sys.platform != "win32":
            return {"ok": False, "error": "unsupported"}
        user32 = ctypes.windll.user32
        hwnd = window_hwnd(getattr(self, "_window", None))
        if not hwnd:
            hwnd = int(user32.GetForegroundWindow())
        return nc_drag(hwnd, _HTCAPTION)

    def window_start_resize(self, edge: str = "right") -> dict:
        if sys.platform != "win32":
            return {"ok": False, "error": "unsupported"}
        key = str(edge or "right").strip().lower().replace("_", "-")
        ht = _HT_BY_EDGE.get(key)
        if ht is None:
            return {"ok": False, "error": f"bad edge: {edge}"}
        user32 = ctypes.windll.user32
        hwnd = window_hwnd(getattr(self, "_window", None))
        if not hwnd:
            hwnd = int(user32.GetForegroundWindow())
        return nc_drag(hwnd, ht)


def create_tool_window(
    *,
    title: str,
    url: str,
    js_api: Any,
    width: int = TOOL_WIDTH,
    height: int = TOOL_HEIGHT,
    min_size: tuple[int, int] = TOOL_MIN_SIZE,
    background_color: str = "#06070c",
    **extra: Any,
) -> Any:
    """Create a frameless, resizable tool window and bind js_api._window."""
    kwargs: dict[str, Any] = dict(
        title=title,
        url=url,
        js_api=js_api,
        width=int(width),
        height=int(height),
        min_size=tuple(min_size),
        frameless=True,
        resizable=True,
        easy_drag=False,
        shadow=True,
        background_color=background_color,
    )
    kwargs.update(extra)
    window = webview.create_window(**kwargs)
    if hasattr(js_api, "set_window") and callable(getattr(js_api, "set_window")):
        js_api.set_window(window)
    else:
        js_api._window = window
        js_api._maximized = False
    return window
