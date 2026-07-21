"""Lightweight always-on-top FPS HUD overlay (draggable)."""
from __future__ import annotations

import ctypes
import json
import threading
import time
from ctypes import wintypes
from pathlib import Path
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from fps_worker_manager import FpsWorkerManager

OVERLAY_TITLE = "Opti HUD"
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080
SWP_NOSIZE = 0x0001
SWP_NOZORDER = 0x0004
SWP_SHOWWINDOW = 0x0040


class FpsOverlay:
    def __init__(self, fps: FpsWorkerManager, root: Path) -> None:
        self._fps = fps
        self._root = root
        self._pos_file = root / "overlay-pos.json"
        self._window: Any = None
        self._enabled = False
        self._poll_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._last_pos: tuple[int, int] | None = None

    def set_window(self, window: Any) -> None:
        self._window = window

    def _hwnd(self) -> int | None:
        if not self._window:
            return None
        try:
            user32 = ctypes.windll.user32
            hwnd = user32.FindWindowW(None, OVERLAY_TITLE)
            if hwnd:
                return int(hwnd)
            native = getattr(self._window, "native", None)
            if native is not None:
                handle = getattr(native, "Handle", None)
                if handle is not None:
                    return int(handle)
        except Exception:
            pass
        return None

    def _default_position(self) -> tuple[int, int]:
        user32 = ctypes.windll.user32
        sw = user32.GetSystemMetrics(0)
            w = int(getattr(self._window, "width", 168) or 168)
        return max(8, sw - w - 16), 16

    def _load_position(self) -> tuple[int, int] | None:
        try:
            if self._pos_file.is_file():
                data = json.loads(self._pos_file.read_text(encoding="utf-8"))
                x = int(data.get("x", 0))
                y = int(data.get("y", 0))
                if x >= 0 and y >= 0:
                    return x, y
        except Exception:
            pass
        return None

    def _save_position(self, x: int, y: int) -> None:
        try:
            self._pos_file.write_text(
                json.dumps({"x": x, "y": y}, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _position_window(self) -> None:
        if not self._window:
            return
        try:
            saved = self._load_position()
            if saved:
                self._window.move(saved[0], saved[1])
                self._last_pos = saved
            else:
                x, y = self._default_position()
                self._window.move(x, y)
                self._last_pos = (x, y)
        except Exception:
            pass

    def _apply_toolwindow(self) -> None:
        hwnd = self._hwnd()
        if not hwnd:
            return
        try:
            user32 = ctypes.windll.user32
            style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE)
            user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style | WS_EX_TOOLWINDOW)
        except Exception:
            pass

    def _track_position(self) -> None:
        hwnd = self._hwnd()
        if not hwnd:
            return
        try:
            rect = wintypes.RECT()
            if not ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect)):
                return
            pos = (int(rect.left), int(rect.top))
            if self._last_pos != pos:
                self._last_pos = pos
                self._save_position(pos[0], pos[1])
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
                self._track_position()
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
                self._position_window()
                self._window.show()
                time.sleep(0.2)
                self._apply_toolwindow()
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
            self._track_position()
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
