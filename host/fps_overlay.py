# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""Native WinForms FPS HUD — TransparencyKey + owner-drawn text (no ClearType punch-out)."""
from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Any, TYPE_CHECKING, Callable

from system_stats import HardwareStatsSampler

if TYPE_CHECKING:
    from fps_worker_manager import FpsWorkerManager

OVERLAY_TITLE = "SoftTunes HUD"
# Magenta chroma-key — must not appear in neon HUD colors.
_KEY_RGB = (255, 0, 255)

DEFAULT_CONFIG: dict[str, Any] = {
    "layout": "line",
    "scale": 1.0,
    "colors": {
        "accent": "#e03545",
        "text": "#f0f2f5",
        "brand": "#e03545",
        "fps": "#ff6b7a",
        "muted": "#a8aab4",
    },
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
    "card": (220, 140),
}

_HEX_RE = re.compile(r"^#?[0-9a-fA-F]{6}$")


def _normalize_hex(value: Any, fallback: str) -> str:
    s = str(value or "").strip()
    if not _HEX_RE.match(s):
        return fallback
    return s if s.startswith("#") else f"#{s}"


def _clamp_scale(value: Any) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 1.0
    return max(0.7, min(2.2, round(n, 2)))


def _merge_config(raw: Any) -> dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if not isinstance(raw, dict):
        return cfg
    layout = raw.get("layout")
    if layout in ("line", "card"):
        cfg["layout"] = layout
    if "scale" in raw:
        cfg["scale"] = _clamp_scale(raw.get("scale"))
    colors = raw.get("colors")
    if isinstance(colors, dict):
        for key in cfg["colors"]:
            if key in colors:
                cfg["colors"][key] = _normalize_hex(colors[key], cfg["colors"][key])
    show = raw.get("show")
    if isinstance(show, dict):
        for key in cfg["show"]:
            if key in show:
                cfg["show"][key] = bool(show[key])
    return cfg


def _hex_to_color(hex_color: str):
    from System.Drawing import Color  # type: ignore

    s = _normalize_hex(hex_color, "#39ff14").lstrip("#")
    return Color.FromArgb(255, int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def _key_color():
    from System.Drawing import Color  # type: ignore

    return Color.FromArgb(255, _KEY_RGB[0], _KEY_RGB[1], _KEY_RGB[2])


class FpsOverlay:
    def __init__(self, fps: FpsWorkerManager, root: Path, data_dir: Path | None = None) -> None:
        self._fps = fps
        self._root = root
        writable = data_dir or root
        (writable / "logs").mkdir(parents=True, exist_ok=True)
        self._pos_file = writable / "overlay-pos.json"
        self._cfg_file = writable / "overlay-config.json"
        self._log_file = writable / "logs" / "overlay-hud.log"
        self._gui_host: Any = None
        self._form: Any = None
        self._enabled = False
        self._poll_thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()
        self._last_pos: tuple[int, int] | None = None
        self._config = self._load_config()
        self._stats = HardwareStatsSampler(root)
        self._drag: tuple[int, int, int, int] | None = None
        self._last_payload: dict[str, Any] = {}
        self._line_text = "SOFTTUNES  |  -- FPS  |  En attente"
        self._line_color_hex = "#f7ff00"

    def set_window(self, window: Any) -> None:
        self._gui_host = window

    def get_config(self) -> dict[str, Any]:
        return json.loads(json.dumps(self._config))

    def set_config(self, raw: Any) -> dict[str, Any]:
        with self._lock:
            self._config = _merge_config(raw)
            self._save_config(self._config)
            if self._enabled:
                # Rebuild text + shrink/grow to match visible metrics.
                self._ui(lambda: self._render(self._last_payload))
            return {"ok": True, "config": self.get_config()}

    def _log(self, msg: str) -> None:
        try:
            self._log_file.parent.mkdir(parents=True, exist_ok=True)
            with self._log_file.open("a", encoding="utf-8") as f:
                f.write(msg.rstrip() + "\n")
        except Exception:
            pass

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

    def _font_pt(self) -> float:
        layout = self._config.get("layout") or "line"
        scale = _clamp_scale(self._config.get("scale", 1.0))
        return max(8.0, (16.0 if layout == "card" else 11.0) * scale)

    def _content_text(self) -> str:
        text = (self._line_text or "").strip()
        if text:
            return text
        payload = self._last_payload if isinstance(getattr(self, "_last_payload", None), dict) else {}
        text = self._format_line(payload or {}).strip()
        return text or "-- FPS"

    def _size_for_layout(self) -> tuple[int, int]:
        """Fit window to visible metrics (minimal = compact bar)."""
        layout = self._config.get("layout") or "line"
        scale = _clamp_scale(self._config.get("scale", 1.0))
        base_w, base_h = LAYOUT_SIZES.get(layout, LAYOUT_SIZES["line"])
        text = self._content_text()
        try:
            from System.Drawing import Bitmap, Font, FontStyle, Graphics  # type: ignore

            font = Font("Segoe UI", self._font_pt(), FontStyle.Bold)
            bmp = Bitmap(8, 8)
            g = Graphics.FromImage(bmp)
            try:
                if layout == "card":
                    max_w = max(140, int(round(base_w * scale)))
                    sz = g.MeasureString(text, font, max_w)
                    w = max(120, min(max_w + 24, int(sz.Width) + 28))
                    h = max(48, int(sz.Height) + 22)
                else:
                    line = text.replace("\n", "  |  ")
                    sz = g.MeasureString(line, font)
                    # Tight pad; scale only affects font, not a huge empty bar.
                    w = max(72, int(sz.Width) + 28)
                    h = max(28, int(sz.Height) + 12)
            finally:
                g.Dispose()
                bmp.Dispose()
                font.Dispose()
            # Cap so a full HUD never exceeds most of the screen.
            try:
                _, _, sw, _ = self._screen_bounds()
                w = min(w, max(160, int(sw * 0.92)))
            except Exception:
                pass
            return w, h
        except Exception:
            return max(160, int(round(base_w * scale))), max(32, int(round(base_h * scale)))

    def _form_size(self) -> tuple[int, int]:
        form = self._form
        if form is not None and not form.IsDisposed:
            try:
                return int(form.Width), int(form.Height)
            except Exception:
                pass
        return self._size_for_layout()

    def _screen_bounds(self) -> tuple[int, int, int, int]:
        """Return (left, top, width, height) of primary working area."""
        try:
            from System.Windows.Forms import Screen  # type: ignore

            wa = Screen.PrimaryScreen.WorkingArea
            return int(wa.Left), int(wa.Top), int(wa.Width), int(wa.Height)
        except Exception:
            import ctypes

            user32 = ctypes.windll.user32
            return 0, 0, int(user32.GetSystemMetrics(0)), int(user32.GetSystemMetrics(1))

    def _default_position(self) -> tuple[int, int]:
        left, top, sw, sh = self._screen_bounds()
        w, h = self._size_for_layout()
        return max(left + 8, left + sw - w - 16), max(top + 8, top + 16)

    def _clamp_position(self, x: int, y: int) -> tuple[int, int]:
        left, top, sw, sh = self._screen_bounds()
        w, h = self._form_size()
        max_x = left + max(8, sw - w - 8)
        max_y = top + max(8, sh - h - 8)
        return max(left + 8, min(x, max_x)), max(top + 8, min(y, max_y))

    def _load_position(self) -> tuple[int, int] | None:
        try:
            if self._pos_file.is_file():
                data = json.loads(self._pos_file.read_text(encoding="utf-8"))
                x = int(data.get("x", 0))
                y = int(data.get("y", 0))
                if x >= 0 and y >= 0:
                    return self._clamp_position(x, y)
        except Exception:
            pass
        return None

    def _save_position(self, x: int, y: int) -> None:
        try:
            cx, cy = self._clamp_position(int(x), int(y))
            self._pos_file.write_text(
                json.dumps({"x": cx, "y": cy}, ensure_ascii=True),
                encoding="utf-8",
            )
        except Exception:
            pass

    def _ui(self, fn: Callable[[], None]) -> None:
        form = self._form
        if form is None:
            return
        try:
            if form.IsDisposed:
                return
            if form.InvokeRequired:
                from System import Action  # type: ignore

                form.BeginInvoke(Action(fn))
            else:
                fn()
        except Exception as exc:
            self._log(f"ui err: {exc}")

    def _host_invoke(self, fn: Callable[[], None], *, sync: bool = False) -> None:
        host = self._gui_host
        native = getattr(host, "native", None) if host else None
        try:
            from System import Action  # type: ignore
            from System.Windows.Forms import Application  # type: ignore

            target = None
            if native is not None and hasattr(native, "Invoke"):
                target = native
            elif Application.OpenForms.Count > 0:
                target = Application.OpenForms[0]
            if target is not None:
                if sync and hasattr(target, "Invoke"):
                    target.Invoke(Action(fn))
                else:
                    target.BeginInvoke(Action(fn))
                return
        except Exception as exc:
            self._log(f"host_invoke err: {exc}")
        try:
            fn()
        except Exception as exc:
            self._log(f"host_invoke direct err: {exc}")

    def _ensure_form(self) -> None:
        if self._form is not None and not self._form.IsDisposed:
            return
        import ctypes

        from System.Drawing import (  # type: ignore
            Color,
            Font,
            FontStyle,
            Point,
            RectangleF,
            SolidBrush,
            StringFormat,
            StringAlignment,
            Pen,
            Region,
        )
        from System.Drawing.Drawing2D import (  # type: ignore
            GraphicsPath,
            SmoothingMode,
        )
        from System.Drawing.Text import TextRenderingHint  # type: ignore
        from System.Windows.Forms import (  # type: ignore
            Form,
            FormBorderStyle,
            FormStartPosition,
            MouseButtons,
            Padding,
        )

        # Dark void panel (hittable everywhere). Corners via Region — no TransparencyKey
        # (keyed windows only receive clicks on opaque pixels → undraggable).
        panel = Color.FromArgb(255, 10, 10, 14)
        form = Form()
        form.Text = OVERLAY_TITLE
        form.FormBorderStyle = getattr(FormBorderStyle, "None")
        form.ShowInTaskbar = False
        form.TopMost = True
        form.StartPosition = FormStartPosition.Manual
        form.BackColor = panel
        form.Padding = Padding(0)

        def _radius() -> int:
            scale = _clamp_scale(self._config.get("scale", 1.0))
            return max(8, int(round(10 * scale)))

        def _apply_round_region() -> None:
            r = form.ClientRectangle
            if r.Width < 4 or r.Height < 4:
                return
            rad = min(_radius(), r.Width // 2, r.Height // 2)
            path = GraphicsPath()
            d = rad * 2
            path.AddArc(r.X, r.Y, d, d, 180, 90)
            path.AddArc(r.Right - d - 1, r.Y, d, d, 270, 90)
            path.AddArc(r.Right - d - 1, r.Bottom - d - 1, d, d, 0, 90)
            path.AddArc(r.X, r.Bottom - d - 1, d, d, 90, 90)
            path.CloseFigure()
            form.Region = Region(path)
            path.Dispose()

        def on_down(sender, e):  # noqa: ANN001
            if e.Button != MouseButtons.Left:
                return
            # Native caption drag — works even with frameless forms.
            try:
                hwnd = int(form.Handle.ToInt32())
                ctypes.windll.user32.ReleaseCapture()
                # WM_NCLBUTTONDOWN=0x00A1, HTCAPTION=2
                ctypes.windll.user32.SendMessageW(hwnd, 0x00A1, 2, 0)
            except Exception:
                self._drag = (int(e.X), int(e.Y), int(form.Left), int(form.Top))

        def on_move(sender, e):  # noqa: ANN001
            if self._drag is not None and e.Button == MouseButtons.Left:
                dx, dy, fx, fy = self._drag
                nx, ny = self._clamp_position(fx + (int(e.X) - dx), fy + (int(e.Y) - dy))
                form.Left = nx
                form.Top = ny

        def on_up(sender, e):  # noqa: ANN001
            self._last_pos = (int(form.Left), int(form.Top))
            self._save_position(form.Left, form.Top)
            self._drag = None

        def on_moved(sender, e):  # noqa: ANN001
            # Persist after native HTCAPTION drag too.
            self._last_pos = (int(form.Left), int(form.Top))
            self._save_position(form.Left, form.Top)

        def on_paint(sender, e):  # noqa: ANN001
            g = e.Graphics
            g.SmoothingMode = SmoothingMode.AntiAlias
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit
            g.Clear(panel)
            colors = self._config.get("colors") or {}
            accent = _hex_to_color(str(colors.get("accent") or "#39ff14"))
            text_c = _hex_to_color(self._line_color_hex)
            layout = self._config.get("layout") or "line"
            scale = _clamp_scale(self._config.get("scale", 1.0))
            font_pt = max(8.0, (16.0 if layout == "card" else 11.0) * scale)
            font = Font("Segoe UI", font_pt, FontStyle.Bold)
            sf = StringFormat()
            sf.Alignment = StringAlignment.Near if layout == "line" else StringAlignment.Center
            sf.LineAlignment = StringAlignment.Center
            brush = SolidBrush(text_c)
            rect = form.ClientRectangle
            pad = 10.0
            text_rect = RectangleF(
                pad,
                0.0,
                float(max(10, rect.Width - int(pad) * 2)),
                float(rect.Height),
            )
            text = str(self._line_text or "SOFTTUNES")
            g.DrawString(text, font, brush, text_rect, sf)

            # Rounded neon border
            rad = min(_radius(), rect.Width // 2, rect.Height // 2)
            d = rad * 2
            path = GraphicsPath()
            inset = 1
            x, y = rect.X + inset, rect.Y + inset
            w, h = rect.Width - inset * 2 - 1, rect.Height - inset * 2 - 1
            path.AddArc(x, y, d, d, 180, 90)
            path.AddArc(x + w - d, y, d, d, 270, 90)
            path.AddArc(x + w - d, y + h - d, d, d, 0, 90)
            path.AddArc(x, y + h - d, d, d, 90, 90)
            path.CloseFigure()
            pen = Pen(accent, 2)
            g.DrawPath(pen, path)
            pen.Dispose()
            path.Dispose()
            brush.Dispose()
            font.Dispose()
            sf.Dispose()

        def on_resize(sender, e):  # noqa: ANN001
            _apply_round_region()
            form.Invalidate()

        form.MouseDown += on_down
        form.MouseMove += on_move
        form.MouseUp += on_up
        form.LocationChanged += on_moved
        form.Paint += on_paint
        form.Resize += on_resize

        self._form = form
        self._apply_chrome()
        _apply_round_region()

        try:
            hwnd = int(form.Handle.ToInt32())
            user32 = ctypes.windll.user32
            style = user32.GetWindowLongW(hwnd, -20)
            user32.SetWindowLongW(hwnd, -20, style | 0x00000080)  # WS_EX_TOOLWINDOW
        except Exception:
            pass

        saved = self._load_position()
        if saved:
            x, y = saved
        else:
            x, y = self._default_position()
        x, y = self._clamp_position(x, y)
        form.Location = Point(x, y)
        self._last_pos = (x, y)
        self._log(f"form created at {x},{y} size={form.Width}x{form.Height}")

    def _apply_chrome(self) -> None:
        form = self._form
        if form is None:
            return
        from System.Drawing import Size  # type: ignore

        w, h = self._size_for_layout()
        if int(form.Width) != w or int(form.Height) != h:
            form.Size = Size(w, h)
            try:
                form.PerformLayout()
            except Exception:
                pass
        form.Invalidate()

    def _format_line(self, d: dict[str, Any]) -> str:
        show = self._config.get("show") or {}
        layout = self._config.get("layout") or "line"
        parts: list[str] = []
        if show.get("brand", True):
            parts.append("SOFTTUNES")
        if show.get("fps", True):
            parts.append(f"{d['fps']} FPS" if d.get("fps") is not None else "-- FPS")
        if show.get("frametime", True) and d.get("frametimeMs") is not None:
            parts.append(f"{d['frametimeMs']} ms")
        if show.get("onePercentLow", True) and d.get("onePercentLow") is not None:
            parts.append(f"1% {d['onePercentLow']}")
        cpu_bits: list[str] = []
        if show.get("cpu", True) and d.get("cpuPct") is not None:
            cpu_bits.append(f"{d['cpuPct']}%")
        if show.get("cpuTemp", True) and d.get("cpuTempC") is not None:
            cpu_bits.append(f"{d['cpuTempC']}C")
        if cpu_bits:
            parts.append("CPU " + " ".join(cpu_bits))
        gpu_bits: list[str] = []
        if show.get("gpu", True) and d.get("gpuPct") is not None:
            gpu_bits.append(f"{d['gpuPct']}%")
        if show.get("gpuTemp", True) and d.get("gpuTempC") is not None:
            gpu_bits.append(f"{d['gpuTempC']}C")
        if gpu_bits:
            parts.append("GPU " + " ".join(gpu_bits))
        if show.get("ram", True) and d.get("ramPct") is not None:
            parts.append(f"RAM {d['ramPct']}%")
        if show.get("app", True):
            parts.append(str(d.get("app") or d.get("status") or "En attente"))
        return "\n".join(parts) if layout == "card" else "  |  ".join(parts)

    def _render(self, d: dict[str, Any]) -> None:
        colors = self._config.get("colors") or {}
        live = d.get("fps") is not None
        self._line_color_hex = str(
            (colors.get("accent") if live else None)
            or colors.get("fps")
            or colors.get("text")
            or "#f7ff00"
        )
        self._line_text = self._format_line(d)
        if self._form is not None:
            self._apply_chrome()

    def _push_sample(self, sample: dict[str, Any]) -> None:
        hw = self._stats.sample()
        payload: dict[str, Any] = {
            "fps": sample.get("fps"),
            "frametimeMs": sample.get("frametimeMs"),
            "onePercentLow": sample.get("onePercentLow"),
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
        self._last_payload = payload
        self._ui(lambda: self._render(payload))

    def _poll_loop(self) -> None:
        while not self._stop.wait(1.0):
            try:
                self._push_sample(self._fps.get_sample())
                form = self._form
                if form is not None and not form.IsDisposed:
                    pos = self._clamp_position(int(form.Left), int(form.Top))
                    if (int(form.Left), int(form.Top)) != pos:
                        self._ui(lambda p=pos: setattr(form, "Left", p[0]) or setattr(form, "Top", p[1]))
                    if self._last_pos != pos:
                        self._last_pos = pos
                        self._save_position(pos[0], pos[1])
            except Exception as exc:
                self._log(f"poll err: {exc}")

    def _show_form(self) -> None:
        self._ensure_form()
        form = self._form
        if form is None:
            self._log("show_form: no form")
            return
        self._apply_chrome()
        x, y = self._clamp_position(int(form.Left), int(form.Top))
        form.Left = x
        form.Top = y
        form.Show()
        form.BringToFront()
        form.TopMost = True
        self._push_sample(self._fps.get_sample())
        self._log(f"shown visible={form.Visible} at {form.Left},{form.Top}")

    def _hide_form(self) -> None:
        form = self._form
        if form is None:
            return
        try:
            self._save_position(int(form.Left), int(form.Top))
            form.Hide()
        except Exception as exc:
            self._log(f"hide err: {exc}")

    def enable(self) -> dict[str, Any]:
        with self._lock:
            if self._enabled:
                return {"ok": True, "enabled": True, "config": self.get_config()}
            acquired = self._fps.acquire()
            if not acquired.get("ok"):
                return acquired
            self._enabled = True
            self._stop.clear()
            err: list[str] = []
            ready = threading.Event()

            def create_and_show() -> None:
                try:
                    self._show_form()
                except Exception as exc:
                    err.append(str(exc))
                    self._log(f"enable show err: {exc}")
                finally:
                    ready.set()

            self._host_invoke(create_and_show, sync=False)
            if not ready.wait(timeout=8.0):
                self._log("enable timeout waiting UI thread")
                # Last resort: try sync / direct
                try:
                    self._host_invoke(create_and_show, sync=True)
                    ready.wait(timeout=3.0)
                except Exception as exc:
                    err.append(str(exc))
            if self._form is None or (hasattr(self._form, "Visible") and not self._form.Visible):
                self._enabled = False
                self._fps.release()
                return {
                    "ok": False,
                    "error": (err[0] if err else "HUD native non affiche — voir logs/overlay-hud.log"),
                }
            self._poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._poll_thread.start()
            return {"ok": True, "enabled": True, "config": self.get_config()}

    def disable(self) -> dict[str, Any]:
        with self._lock:
            if not self._enabled:
                return {"ok": True, "enabled": False}
            self._enabled = False
            self._stop.set()
            ready = threading.Event()

            def hide() -> None:
                try:
                    self._hide_form()
                finally:
                    ready.set()

            self._host_invoke(hide)
            ready.wait(timeout=3.0)
            self._fps.release()
            return {"ok": True, "enabled": False}

    def is_enabled(self) -> bool:
        return self._enabled

    def shutdown(self) -> None:
        self.disable()
        form = self._form

        def close() -> None:
            try:
                if form is not None and not form.IsDisposed:
                    form.Close()
                    form.Dispose()
            except Exception:
                pass

        self._host_invoke(close)
        self._form = None
        self._stats.close()
