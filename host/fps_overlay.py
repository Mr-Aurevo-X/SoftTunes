# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""Lightweight always-on-top FPS HUD overlay (draggable, configurable)."""
from __future__ import annotations

import ctypes
import json
import threading
import time
from ctypes import wintypes
from pathlib import Path
from typing import Any, TYPE_CHECKING

from system_stats import HardwareStatsSampler

if TYPE_CHECKING:
    from fps_worker_manager import FpsWorkerManager

OVERLAY_TITLE = "Opti HUD"
GWL_EXSTYLE = -20
WS_EX_TOOLWINDOW = 0x00000080

DEFAULT_CONFIG: dict[str, Any] = {
    "layout": "line",
    "show": {
        "brand": True,
        "fps": True,
        "frametime": True,
        "onePercentLow": True,
        "app": True,
        "cpu": True,
        "cpuTemp": True,
        "gpu": True,
        "gpuTemp": True,
        "ram": True,
    },
}

LAYOUT_SIZES = {
    "line": (560, 40),
    "card": (180, 128),
}


def _merge_config(raw: Any) -> dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if not isinstance(raw, dict):
        return cfg
    layout = raw.get("layout")
    if layout in ("line", "card"):
        cfg["layout"] = layout
    show = raw.get("show")
    if isinstance(show, dict):
        for key in cfg["show"]:
            if key in show:
                cfg["show"][key] = bool(show[key])
    return cfg


class FpsOverlay:
    def __init__(self, fps: FpsWorkerManager, root: Path) -> None:
        self._fps = fps
        self._root = root
        self._pos_file = root / "overlay-pos.json"
        self._cfg_file = root / "overlay-config.json"
        self._window: Any = None
        self._enabled = False
        self._poll_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._last_pos: tuple[int, int] | None = None
        self._config = self._load_config()
        self._stats = HardwareStatsSampler(root)
        self._config_dirty = True

    def set_window(self, window: Any) -> None:
        self._window = window

    def get_config(self) -> dict[str, Any]:
        return json.loads(json.dumps(self._config))

    def set_config(self, raw: Any) -> dict[str, Any]:
        with self._lock:
            self._config = _merge_config(raw)
            self._save_config(self._config)
            self._config_dirty = True
            if self._enabled and self._window:
                self._apply_layout_size()
                self._push_config()
                self._push_sample(self._fps.get_sample())
            return {"ok": True, "config": self.get_config()}

    def _load_config(self) -> dict[str, Any]:
        try:
            if self._cfg_file.is_file():
                return _merge_config(json.loads(self._cfg_file.read_text(encoding="utf-8")))
        except Exception:
            pass
        return _merge_config(None)

    def _save_config(self, cfg: dict[str, Any]) -> None:
        try:
            self._cfg_file.write_text(
                json.dumps(cfg, ensure_ascii=True, indent=2),
                encoding="utf-8",
            )
        except Exception:
            pass

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

    def _size_for_layout(self) -> tuple[int, int]:
        layout = self._config.get("layout") or "line"
        return LAYOUT_SIZES.get(layout, LAYOUT_SIZES["line"])

    def _apply_layout_size(self) -> None:
        if not self._window:
            return
        try:
            w, h = self._size_for_layout()
            self._window.resize(w, h)
        except Exception:
            pass

    def _default_position(self) -> tuple[int, int]:
        user32 = ctypes.windll.user32
        sw = user32.GetSystemMetrics(0)
        w, _ = self._size_for_layout()
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
                json.dumps({"x": x, "y": y}, ensure_ascii=True),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _position_window(self) -> None:
        if not self._window:
            return
        try:
            self._apply_layout_size()
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

    def _push_config(self) -> None:
        if not self._window:
            return
        try:
            js = "applyOverlayConfig(" + json.dumps(self._config, ensure_ascii=True) + ")"
            self._window.evaluate_js(js)
            self._config_dirty = False
        except Exception:
            pass

    def _push_sample(self, sample: dict[str, Any]) -> None:
        if not self._window:
            return
        if self._config_dirty:
            self._push_config()
        hw = self._stats.sample()
        payload: dict[str, Any] = {
            "fps": sample.get("fps"),
            "frametimeMs": sample.get("frametimeMs"),
            "onePercentLow": sample.get("onePercentLow"),
            "fpsMin": sample.get("fpsMin"),
            "fpsMax": sample.get("fpsMax"),
            "app": sample.get("app"),
            "cpuPct": hw.get("cpuPct"),
            "cpuTempC": hw.get("cpuTempC"),
            "gpuPct": hw.get("gpuPct"),
            "gpuTempC": hw.get("gpuTempC"),
            "ramPct": hw.get("ramPct"),
        }
        if not sample.get("available"):
            err = (sample.get("error") or "").strip()
            if err:
                payload["status"] = err[:48]
            elif sample.get("captureActive"):
                payload["status"] = "Jeu..."
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
                return {"ok": True, "enabled": True, "config": self.get_config()}
            acquired = self._fps.acquire()
            if not acquired.get("ok"):
                return acquired
            self._enabled = True
            self._stop.clear()
            self._config_dirty = True
            if self._window:
                self._position_window()
                self._window.show()
                time.sleep(0.2)
                self._apply_toolwindow()
                self._push_config()
                self._push_sample(self._fps.get_sample())
            self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._poll_thread.start()
            return {"ok": True, "enabled": True, "config": self.get_config()}

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
        self._stats.close()
