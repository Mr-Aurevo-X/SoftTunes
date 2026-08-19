"""Opti — host WebView2 (UI HTML, pont PowerShell JSON + progression %)."""
from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any

import webview

from fps_worker_manager import FpsWorkerManager
from fps_overlay import FpsOverlay, OVERLAY_TITLE
from window_chrome import WindowChromeMixin, create_tool_window

_DENIED_OPEN_EXTS = {
    ".exe", ".cmd", ".bat", ".ps1", ".vbs", ".msi", ".com", ".scr", ".js", ".jse", ".wsf",
}


def _safe_open_path(path: str, *, deny_exec: bool = True) -> tuple[Path | None, str]:
    raw = str(path or "").strip()
    if not raw:
        return None, "empty path"
    if raw.startswith("\\\\"):
        return None, "UNC rejected"
    try:
        p = Path(raw).expanduser().resolve()
    except OSError:
        return None, "invalid path"
    if not p.exists():
        return None, "path not found"
    if deny_exec and p.is_file() and p.suffix.lower() in _DENIED_OPEN_EXTS:
        return None, f"executable extension blocked: {p.suffix.lower()}"
    return p, ""


def app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def ui_dir() -> Path:
    # Prefer loose ui/ next to the exe (hotfix without full rebuild)
    external = app_dir() / "ui"
    if (external / "index.html").is_file():
        return external
    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", app_dir()))
        nested = base / "ui"
        return nested if nested.is_dir() else base
    return Path(__file__).resolve().parent.parent / "ui"


def is_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def elevate_self() -> bool:
    if is_admin():
        return False
    try:
        if getattr(sys, "frozen", False):
            params = " ".join(f'"{a}"' for a in sys.argv[1:])
            rc = ctypes.windll.shell32.ShellExecuteW(
                None, "runas", str(Path(sys.executable).resolve()), params or None, str(app_dir()), 1
            )
        else:
            script = str(Path(__file__).resolve())
            py = sys.executable
            args = f'"{script}"'
            rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", py, args, str(app_dir()), 1)
        return int(rc) > 32
    except Exception:
        return False


DEFAULT_ACCENT = "#e03545"
ENV_ACCENT = "MRAUREVOX_ACCENT"
ENV_LANG = "MRAUREVOX_LANG"
OPTI_INSTALL_DIR = "OptiBy-Mr-Aurevo-X"
HUB_SETTINGS_DIR = "PCCommand"

# Actions that need elevation (HKLM, services, AppX, restore, softperf HAGS, clocks, etc.)
ADMIN_ACTIONS = frozenset({
    "createRestorePoint",
    "setServices",
    "removeBloat",
    "setMmcs",
    "setSoftPerfOs",
    "setNvidiaPowerLimit",
    "resetSoftPerf",
    "setNvidiaClocks",
    "resetNvidiaClocks",
    "applyGamingPreset",
    "disableStartup",
    "runUndo",
    "setPowerPlan",
})

URL_ALLOWLIST = frozenset({
    "https://www.msi.com/Landing/afterburner",
    "http://www.msi.com/Landing/afterburner",
})


def action_needs_admin(action: str, payload: dict | None = None) -> bool:
    if action in ADMIN_ACTIONS:
        # Balanced/High power plans often work without admin; Ultimate usually needs it.
        if action == "setPowerPlan":
            profile = str((payload or {}).get("profile") or "").strip().lower()
            return profile == "ultimate"
        return True
    return False


def _localappdata() -> Path:
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(local)


def _settings_paths() -> list[Path]:
    root = _localappdata()
    return [
        root / OPTI_INSTALL_DIR / "user-settings.json",
        root / HUB_SETTINGS_DIR / "user-settings.json",
        root / "MrAurevoX" / "user-settings.json",
        root / "Mr-Aurevo-X" / "user-settings.json",
    ]


def resolve_suite_accent(default: str = DEFAULT_ACCENT) -> str:
    env = (os.environ.get(ENV_ACCENT) or "").strip()
    if env.startswith("#") and len(env) in (4, 7):
        return env
    for path in _settings_paths():
        if not path.is_file():
            continue
        try:
            loaded = json.loads(path.read_text(encoding="utf-8-sig"))
            accent = str((loaded or {}).get("accent") or "").strip()
            if accent.startswith("#") and len(accent) in (4, 7):
                return accent
        except (OSError, json.JSONDecodeError, TypeError):
            continue
    return default


def resolve_suite_language(default: str = "fr") -> str:
    env = (os.environ.get(ENV_LANG) or "").strip().lower()
    if env in ("fr", "en"):
        return env
    for path in _settings_paths():
        if not path.is_file():
            continue
        try:
            loaded = json.loads(path.read_text(encoding="utf-8-sig"))
            lang = str((loaded or {}).get("language") or "").strip().lower()
            if lang in ("fr", "en"):
                return lang
        except (OSError, json.JSONDecodeError, TypeError):
            continue
    return default if default in ("fr", "en") else "fr"



class Api(WindowChromeMixin):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.api_ps1 = root / "api" / "Invoke-OptiApi.ps1"
        self.progress_path = root / "logs" / "job-progress.json"
        self._job_lock = threading.Lock()
        self._proc_lock = threading.Lock()
        self._job_thread: threading.Thread | None = None
        self._job_running = False
        self._job_error: str | None = None
        self._job_result: dict[str, Any] | None = None
        self._current_proc: subprocess.Popen[str] | None = None
        self._fps = FpsWorkerManager(root)
        self._overlay = FpsOverlay(self._fps, root)

    def get_suite_accent(self) -> dict:
        return {"ok": True, "accent": resolve_suite_accent()}

    def get_suite_settings(self) -> dict:
        return {
            "ok": True,
            "accent": resolve_suite_accent(),
            "language": resolve_suite_language(),
        }

    def get_suite_language(self) -> dict:
        return {"ok": True, "language": resolve_suite_language()}


    def _kill_current_proc(self) -> None:
        with self._proc_lock:
            proc = self._current_proc
        if proc is None:
            return
        try:
            if proc.poll() is None:
                proc.kill()
                try:
                    proc.wait(timeout=3)
                except Exception:
                    pass
        except Exception:
            pass
        with self._proc_lock:
            if self._current_proc is proc:
                self._current_proc = None

    def run(self, action: str, payload: dict | None = None) -> dict:
        if payload is None:
            payload = {}
        if action_needs_admin(action, payload) and not is_admin():
            return {
                "ok": False,
                "error": "Admin required. Click Elevate in Opti, then retry.",
                "data": {"needsAdmin": True},
            }
        if not self.api_ps1.is_file():
            return {"ok": False, "error": f"API introuvable: {self.api_ps1}", "data": None}

        req = {"action": action, "payload": payload}
        fd_in, path_in = tempfile.mkstemp(prefix="opti-in-", suffix=".json")
        fd_out, path_out = tempfile.mkstemp(prefix="opti-out-", suffix=".json")
        os.close(fd_in)
        os.close(fd_out)
        proc: subprocess.Popen[str] | None = None
        try:
            Path(path_in).write_text(json.dumps(req, ensure_ascii=False), encoding="utf-8")
            Path(path_out).write_text("", encoding="utf-8")

            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.CREATE_NO_WINDOW  # type: ignore[attr-defined]

            proc = subprocess.Popen(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(self.api_ps1),
                    "-InFile",
                    path_in,
                    "-OutFile",
                    path_out,
                ],
                cwd=str(self.root),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=creationflags,
            )
            with self._proc_lock:
                self._current_proc = proc

            try:
                stdout, stderr = proc.communicate(timeout=3600)
            except subprocess.TimeoutExpired:
                self._kill_current_proc()
                return {"ok": False, "error": "Timeout (opération trop longue)", "data": None}

            raw = Path(path_out).read_text(encoding="utf-8").strip()
            if not raw:
                err = (stderr or stdout or f"exit {proc.returncode}").strip()
                return {"ok": False, "error": err or "Réponse API vide", "data": None}
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"ok": False, "error": f"JSON invalide: {raw[:400]}", "data": None}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "data": None}
        finally:
            with self._proc_lock:
                if proc is not None and self._current_proc is proc:
                    self._current_proc = None
            for p in (path_in, path_out):
                try:
                    os.unlink(p)
                except OSError:
                    pass

    def _write_progress_fallback(
        self, percent: int, phase: str, detail: str, done: bool, error: str | None = None
    ) -> None:
        try:
            self.progress_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "percent": percent,
                "phase": phase,
                "detail": detail,
                "done": done,
                "error": error,
                "updatedAt": None,
            }
            self.progress_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    def _read_progress_file(self) -> dict[str, Any]:
        if not self.progress_path.is_file():
            return {
                "percent": 0,
                "phase": "",
                "detail": "",
                "done": False,
                "error": None,
                "updatedAt": None,
            }
        try:
            return json.loads(self.progress_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {
                "percent": 0,
                "phase": "",
                "detail": "",
                "done": False,
                "error": None,
                "updatedAt": None,
            }

    def _job_worker(self, action: str, payload: dict) -> None:
        try:
            res = self.run(action, payload)
            if not res or not res.get("ok"):
                err = (res or {}).get("error") or "Échec de l'action"
                self._job_error = str(err)
                self._job_result = None
                self._write_progress_fallback(100, "Erreur", str(err), True, str(err))
            else:
                self._job_error = None
                self._job_result = res
                prog = self._read_progress_file()
                if not prog.get("done"):
                    self._write_progress_fallback(
                        100, "Terminé", prog.get("detail") or "OK", True, None
                    )
        except Exception as exc:
            self._job_error = str(exc)
            self._job_result = None
            self._write_progress_fallback(100, "Erreur", str(exc), True, str(exc))
        finally:
            with self._job_lock:
                self._job_running = False

    def start_action(self, action: str, payload: dict | None = None) -> dict:
        if payload is None:
            payload = {}
        if action_needs_admin(action, payload) and not is_admin():
            return {
                "ok": False,
                "error": "Admin required. Click Elevate in Opti, then retry.",
                "data": {"needsAdmin": True},
            }
        with self._job_lock:
            if self._job_running:
                # Recover stale flag if worker thread died without clearing.
                if self._job_thread is not None and not self._job_thread.is_alive():
                    self._job_running = False
                else:
                    return {"ok": False, "error": "Une action est déjà en cours", "data": None}
            self._job_running = True
            self._job_error = None
            self._job_result = None
            self._write_progress_fallback(0, action or "Job", "Démarrage...", False, None)
            self._job_thread = threading.Thread(
                target=self._job_worker, args=(action, payload), daemon=True
            )
            self._job_thread.start()
        return {"ok": True, "error": None, "data": {"started": True}}

    def cancel_action(self) -> dict:
        """Kill hung PowerShell and clear job flag so the UI can start new work."""
        self._kill_current_proc()
        with self._job_lock:
            self._job_running = False
            self._job_error = "Annulé"
            self._job_result = None
        self._write_progress_fallback(100, "Annulé", "Annulé par l'UI", True, "Annulé")
        return {"ok": True, "error": None, "data": {"cancelled": True}}

    def get_action_progress(self) -> dict:
        prog = self._read_progress_file()
        with self._job_lock:
            running = self._job_running
            err = self._job_error
        if err and not running:
            prog["done"] = True
            prog["error"] = err
            if not prog.get("phase"):
                prog["phase"] = "Erreur"
        return {
            "ok": True,
            "error": None,
            "data": {
                "percent": int(prog.get("percent") or 0),
                "phase": prog.get("phase") or "",
                "detail": prog.get("detail") or "",
                "done": bool(prog.get("done")) and not running,
                "running": running,
                "error": prog.get("error") or err,
                "updatedAt": prog.get("updatedAt"),
            },
        }

    def get_action_result(self) -> dict:
        with self._job_lock:
            if self._job_running:
                return {"ok": False, "error": "Action encore en cours", "data": None}
            if self._job_error:
                return {"ok": False, "error": self._job_error, "data": None}
            if not self._job_result:
                return {"ok": False, "error": "Aucun résultat", "data": None}
            return self._job_result

    def is_admin(self) -> bool:
        return is_admin()

    def request_elevation(self) -> dict:
        """Re-launch elevated (UAC). Current process should exit after True."""
        if is_admin():
            return {"ok": True, "alreadyAdmin": True}
        ok = elevate_self()
        return {"ok": bool(ok), "elevating": bool(ok), "alreadyAdmin": False}

    def attach_overlay(self, window: Any) -> None:
        self._overlay.set_window(window)

    def start_fps_monitor(self) -> dict:
        try:
            return self._fps.acquire()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def stop_fps_monitor(self) -> dict:
        try:
            return self._fps.release()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def start_fps_overlay(self) -> dict:
        try:
            return self._overlay.enable()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def stop_fps_overlay(self) -> dict:
        try:
            return self._overlay.disable()
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def get_fps_overlay_status(self) -> dict:
        return {
            "ok": True,
            "enabled": self._overlay.is_enabled(),
            "config": self._overlay.get_config(),
        }

    def get_overlay_config(self) -> dict:
        return {"ok": True, "config": self._overlay.get_config()}

    def set_overlay_config(self, config: dict | None = None) -> dict:
        try:
            return self._overlay.set_config(config or {})
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def get_fps_sample(self) -> dict:
        try:
            return self._fps.get_sample()
        except Exception as exc:
            return {
                "ok": False,
                "available": False,
                "fps": None,
                "frametimeMs": None,
                "onePercentLow": None,
                "app": None,
                "error": str(exc),
                "source": "presentmon",
            }

    def open_url(self, url: str) -> dict:
        import webbrowser

        u = (url or "").strip()
        if u not in URL_ALLOWLIST:
            return {"ok": False, "error": "URL non autorisee"}
        try:
            webbrowser.open(u)
            return {"ok": True, "url": u}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def open_path(self, path: str) -> dict:
        try:
            safe, err = _safe_open_path(path, deny_exec=True)
            if safe is None:
                return {"ok": False, "error": err or "Chemin refuse"}
            os.startfile(str(safe))  # type: ignore[attr-defined]
            return {"ok": True}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}


def require_admin() -> None:
    """Opti must run elevated (PresentMon ETW + system tweaks)."""
    if is_admin():
        return
    elevate_self()
    sys.exit(0)


def main() -> None:
    if "--fps-worker" in sys.argv:
        from fps_worker import main as fps_worker_main

        raise SystemExit(fps_worker_main())

    require_admin()

    if "--elevate" in sys.argv:
        if elevate_self():
            sys.exit(0)

    root = app_dir()
    index = ui_dir() / "index.html"
    if not index.is_file():
        raise SystemExit(f"UI introuvable: {index}")

    api = Api(root)
    ver = "1.6.0"
    try:
        vf = root / "version.json"
        if vf.is_file():
            ver = str(json.loads(vf.read_text(encoding="utf-8")).get("version", ver))
    except Exception:
        pass
    overlay_html = ui_dir() / "overlay.html"
    if overlay_html.is_file():
        hud = webview.create_window(
            OVERLAY_TITLE,
            overlay_html.as_uri(),
            width=560,
            height=40,
            frameless=True,
            on_top=True,
            transparent=True,
            hidden=True,
            easy_drag=True,
            resizable=False,
            background_color="#000000",
        )
        api.attach_overlay(hud)

    create_tool_window(
        title=f"Opti {ver}",
        url=index.as_uri(),
        js_api=api,
        background_color="#06070c",
    )
    webview.start(gui="edgechromium", debug=False)


if __name__ == "__main__":
    main()
