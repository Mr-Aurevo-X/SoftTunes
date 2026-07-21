"""FPS / frametime via PresentMon ETW (no RTSS). Runs only inside fps_worker subprocess."""
from __future__ import annotations

import csv
import ctypes
import subprocess
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
SESSION_NAME = "OptiFpsCapture"
MAX_SAMPLES = 240

IGNORE_PROCESSES = frozenset(
    {
        "opti.exe",
        "python.exe",
        "pythonw.exe",
        "explorer.exe",
        "searchhost.exe",
        "shellexperiencehost.exe",
        "applicationframehost.exe",
        "systemsettings.exe",
        "textinputhost.exe",
        "startmenuexperiencehost.exe",
        "lockapp.exe",
        "cursor.exe",
        "code.exe",
        "windowsterminal.exe",
        "cmd.exe",
        "powershell.exe",
        "pwsh.exe",
        "presentmon-x64.exe",
        "presentmon.exe",
    }
)

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32


def _empty(error: str | None, **extra: Any) -> dict[str, Any]:
    out: dict[str, Any] = {
        "ok": True,
        "available": False,
        "fps": None,
        "frametimeMs": None,
        "onePercentLow": None,
        "app": None,
        "error": error,
        "source": "presentmon",
    }
    out.update(extra)
    return out


def find_presentmon(root: Path) -> Path | None:
    for cand in (
        root / "bin" / "PresentMon-x64.exe",
        root.parent / "bin" / "PresentMon-x64.exe",
        root / "tools" / "bin" / "PresentMon-x64.exe",
    ):
        if cand.is_file():
            return cand
    return None


def get_foreground_process() -> tuple[int, str] | None:
    try:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return None
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if not pid.value:
            return None

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
        if not handle:
            return int(pid.value), f"pid:{pid.value}"
        try:
            buf = ctypes.create_unicode_buffer(520)
            size = ctypes.c_ulong(len(buf))
            if kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
                name = Path(buf.value).name
                return int(pid.value), name
        finally:
            kernel32.CloseHandle(handle)
        return int(pid.value), f"pid:{pid.value}"
    except Exception:
        return None


def _parse_float(val: str | None) -> float | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.upper() in ("NA", "N/A", "NAN"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


class PresentMonSession:
    """Long-running PresentMon process; buffers recent frame intervals per PID."""

    def __init__(self, root: Path) -> None:
        self._root = root
        self._proc: subprocess.Popen[str] | None = None
        self._reader: threading.Thread | None = None
        self._lock = threading.Lock()
        self._samples: dict[int, deque[float]] = {}
        self._app_names: dict[int, str] = {}
        self._header: list[str] | None = None
        self._start_error: str | None = None
        self._running = False

    def start(self) -> None:
        if self._proc and self._proc.poll() is None:
            return
        self.stop()
        exe = find_presentmon(self._root)
        if exe is None:
            self._start_error = "PresentMon introuvable (bin/PresentMon-x64.exe)"
            return
        self._start_error = None
        cmd = [
            str(exe),
            "--output_stdout",
            "--no_console_stats",
            "--session_name",
            SESSION_NAME,
            "--stop_existing_session",
            "--exclude",
            "Opti.exe",
            "--exclude",
            "python.exe",
            "--exclude",
            "pythonw.exe",
            "--exclude",
            "PresentMon-x64.exe",
        ]
        try:
            self._proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=CREATE_NO_WINDOW,
            )
        except OSError as exc:
            self._start_error = str(exc)
            return
        self._running = True
        self._reader = threading.Thread(target=self._read_stdout, daemon=True)
        self._reader.start()

    def stop(self) -> None:
        self._running = False
        proc = self._proc
        self._proc = None
        if proc is not None:
            try:
                if proc.poll() is None:
                    proc.kill()
                    proc.wait(timeout=2)
            except Exception:
                pass
        if self._reader and self._reader.is_alive():
            self._reader.join(timeout=1)
        self._reader = None

    def _read_stdout(self) -> None:
        proc = self._proc
        if proc is None or proc.stdout is None:
            return
        try:
            for line in proc.stdout:
                if not self._running:
                    break
                row = line.strip()
                if not row or row.startswith("#"):
                    continue
                if self._header is None:
                    self._header = next(csv.reader([row]))
                    continue
                try:
                    values = next(csv.reader([row]))
                except Exception:
                    continue
                if len(values) < len(self._header):
                    values.extend([""] * (len(self._header) - len(values)))
                data = {self._header[i]: values[i] for i in range(len(self._header))}
                pid_raw = data.get("ProcessID") or data.get("Process Id") or data.get("PID")
                pid = None
                try:
                    if pid_raw:
                        pid = int(float(pid_raw))
                except (TypeError, ValueError):
                    pid = None
                if not pid:
                    continue
                app = (data.get("Application") or data.get("ProcessName") or "").strip()
                if app:
                    self._app_names[pid] = app
                ms = _parse_float(
                    data.get("MsBetweenPresents")
                    or data.get("MsUntilDisplayed")
                    or data.get("MsCPUBusy")
                )
                if ms is None or ms <= 0 or ms > 1000:
                    continue
                with self._lock:
                    buf = self._samples.setdefault(pid, deque(maxlen=MAX_SAMPLES))
                    buf.append(ms)
        except Exception:
            pass
        finally:
            if proc.stderr:
                try:
                    err = proc.stderr.read() or ""
                    if err.strip() and not self._start_error:
                        low = err.lower()
                        if "access" in low or "denied" in low or "privilege" in low:
                            self._start_error = "Accès ETW refusé — lancez Opti en admin"
                except Exception:
                    pass

    def sample(self) -> dict[str, Any]:
        if self._start_error:
            needs_admin = "admin" in self._start_error.lower()
            return _empty(
                self._start_error,
                needsAdmin=needs_admin,
                hintFr="Élevez Opti (admin) pour une capture fiable.",
                hintEn="Run Opti as administrator for reliable capture.",
            )
        if self._proc is None or self._proc.poll() is not None:
            code = self._proc.returncode if self._proc else None
            msg = f"PresentMon arrêté (code {code})" if code else "PresentMon non démarré"
            return _empty(msg, captureActive=False)

        fg = get_foreground_process()
        if fg is None:
            return _empty(
                "Aucune fenêtre au premier plan",
                captureActive=True,
                hintFr="Mettez le jeu au premier plan (Alt+Tab).",
                hintEn="Bring the game to the foreground (Alt+Tab).",
            )
        pid, name = fg
        if name.lower() in IGNORE_PROCESSES:
            return _empty(
                "Lancez un jeu au premier plan",
                captureActive=True,
                hintFr="Le bureau ou Opti est actif — lancez un jeu en plein écran ou fenêtré.",
                hintEn="Desktop or Opti is focused — launch a game.",
            )

        with self._lock:
            buf = self._samples.get(pid)
            app = self._app_names.get(pid) or name

        if not buf:
            return _empty(
                "Capture active — en attente de frames du jeu",
                captureActive=True,
                app=app,
                hintFr="Laissez le jeu afficher des images quelques secondes.",
                hintEn="Let the game render for a few seconds.",
            )

        recent = list(buf)[-60:]
        avg_ms = sum(recent) / len(recent)
        frametime_ms = round(avg_ms, 2)
        fps = round(1000.0 / avg_ms, 1) if avg_ms > 0 else None
        if fps is None or fps < 1 or fps > 10000:
            return _empty("Échantillon invalide", captureActive=True, app=app)

        one_pct = None
        fps_min = None
        fps_max = None
        if len(recent) >= 20:
            ordered = sorted(recent)
            # 99th percentile frametime -> 1% low FPS
            idx = min(len(ordered) - 1, max(0, int(len(ordered) * 0.99) - 1))
            p99_ms = ordered[idx]
            if p99_ms > 0:
                one_pct = round(1000.0 / p99_ms, 1)
            frame_fps = [round(1000.0 / ms, 1) for ms in recent if ms > 0]
            if frame_fps:
                fps_min = min(frame_fps)
                fps_max = max(frame_fps)

        return {
            "ok": True,
            "available": True,
            "fps": fps,
            "frametimeMs": frametime_ms,
            "onePercentLow": one_pct,
            "fpsMin": fps_min,
            "fpsMax": fps_max,
            "app": app,
            "error": None,
            "source": "presentmon",
            "captureActive": True,
        }


def get_fps_sample(root: Path) -> dict[str, Any]:
    """One-shot sample (dev/test); production uses PresentMonSession in fps_worker."""
    session = PresentMonSession(root)
    session.start()
    time.sleep(1.5)
    try:
        return session.sample()
    finally:
        session.stop()
