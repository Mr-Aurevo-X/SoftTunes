"""Lightweight always-on-top FPS HUD overlay (click-through)."""
from __future__ import annotations

import ctypes
import json
import threading
import time
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from fps_worker_manager import FpsWorkerManager

OVERLAY_TITLE = "Opti HUD"
GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TRANSPARENT = 0x00000020
WS_EX_TOOLWINDOW = 0x00000080


class FpsOverlay:
    def __init__(self, fps: FpsWorkerManager) -> None:
        self._fps = fps
        self._window: Any = None
        self._enabled = False
        self._poll_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()

    def set_window(self, window: Any) -> None:
        self._window = window

    def _position_top_right(self) -> None:
        if not self._window:
            return
        try:
            user32 = ctypes.windll.user32
            sw = user32.GetSystemMetrics(0)
            w = int(getattr(self._window, "width", 200) or 200)
            self._window.move(max(8, sw - w - 16), 16)
        except Exception:
            pass

    def _apply_clickthrough(self) -> None:
        if not self._window:
            return
        try:
            user32 = ctypes.windll.user32
            hwnd = user32.FindWindowW(None, OVERLAY_TITLE)
            if not hwnd:
                native = getattr(self._window, "native", None)
                if native is not None:
                    handle = getattr(native, "Handle", None)
                    if handle is not None:
                        hwnd = int(handle)
            if hwnd:
                style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
                user32.SetWindowLongW(
                    hwnd,
                    GWL_EXSTYLE,
                    style | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW,
                )
        except Exception:
            pass

    def _push_sample(self, sample: dict[str, Any]) -> None:
        if not self._window:
            return
        payload: dict[str, Any] = {
            "fps": sample.get("fps"),
            "frametimeMs": sample.get("frametimeMs"),
            "app": sample.get("app"),
        }
        if not sample.get("available"):
            err = (sample.get("error") or "").strip()
            if err:
                payload["status"] = err[:48]
            elif sample.get("captureActive"):
                payload["status"] = "Jeu…"
            else:
                payload["status"] = "Bureau"
        try:
            js = "updateHud(" + json.dumps(payload, ensure_ascii=False) + ")"
            self._window.evaluate_js(js)
        except Exception:
            pass

    def _poll_loop(self) -> None:
        while not self._stop.wait(1.0):
            try:
                sample = self._fps.get_sample()
                self._push_sample(sample)
            except Exception:
                pass

    def enable(self) -> dict[str, Any]:
        with self._lock:
            if self._enabled:
                return {"ok": True, "enabled": True}
            acquired = self._fps.acquire()
            if not acquired.get("ok"):
                return acquired
            self._enabled = True
            self._stop.clear()
            if self._window:
                self._position_top_right()
                self._window.show()
                time.sleep(0.25)
                self._apply_clickthrough()
                self._push_sample(self._fps.get_sample())
            self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._poll_thread.start()
            return {"ok": True, "enabled": True}

    def disable(self) -> dict[str, Any]:
        with self._lock:
            if not self._enabled:
                return {"ok": True, "enabled": False}
            self._enabled = False
            self._stop.set()
            if self._window:
                try:
                    self._window.hide()
                except Exception:
                    pass
            self._fps.release()
            return {"ok": True, "enabled": False}

    def is_enabled(self) -> bool:
        return self._enabled

    def shutdown(self) -> None:
        self.disable()
