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


def resolve_suite_accent(default: str = DEFAULT_ACCENT) -> str:
    env = (os.environ.get(ENV_ACCENT) or "").strip()
    if env.startswith("#") and len(env) in (4, 7):
        return env
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    path = Path(local) / "Mr-Aurevo-X" / "user-settings.json"
    if path.is_file():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8-sig"))
            accent = str((loaded or {}).get("accent") or "").strip()
            if accent.startswith("#") and len(accent) in (4, 7):
                return accent
        except (OSError, json.JSONDecodeError, TypeError):
            pass
    return default


def resolve_suite_language(default: str = "fr") -> str:
    env = (os.environ.get(ENV_LANG) or "").strip().lower()
    if env in ("fr", "en"):
        return env
    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    path = Path(local) / "Mr-Aurevo-X" / "user-settings.json"
    if path.is_file():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8-sig"))
            lang = str((loaded or {}).get("language") or "").strip().lower()
            if lang in ("fr", "en"):
                return lang
        except (OSError, json.JSONDecodeError, TypeError):
            pass
    return default if default in ("fr", "en") else "fr"



class Api:
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

    def open_path(self, path: str) -> dict:
        try:
            os.startfile(path)  # type: ignore[attr-defined]
            return {"ok": True}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    def open_suite_app(self, name: str) -> dict:
        return launch_suite_app(name)


def _suite_candidate_roots() -> list[Path]:
    """Resolve folders that may contain sibling Suite apps."""
    roots: list[Path] = []
    here = app_dir().resolve()
    parent = here.parent

    # Suite layout: <Suite>/<AppName>/ (sibling folders with matching .exe)
    if any((parent / sibling).is_dir() for sibling in ("DiskMap", "NetMap", "Opti", "WinAudit")):
        roots.append(parent)
    elif "Suite Mr-Aurevo-X" in str(parent) or parent.name.lower().startswith("suite"):
        roots.append(parent)
    else:
        roots.append(parent)

    for key in ("MRAUREVOX_SUITE_ROOT", "MRAUREVOX_DEV_ROOT", "MRAUREVOX_APPS_ROOT"):
        raw = (os.environ.get(key) or "").strip()
        if raw:
            roots.append(Path(raw).expanduser().resolve())

    local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
    local_base = Path(local) / "Mr-Aurevo-X"
    for cand in (
        local_base / "Apps",
        local_base,
        Path(local) / "Programs" / "Mr-Aurevo-X" / "Apps",
        Path(local) / "Programs" / "Mr-Aurevo-X",
    ):
        if cand.is_dir():
            roots.append(cand.resolve())

    # user-settings may record launcher Apps path
    settings = local_base / "user-settings.json"
    if settings.is_file():
        try:
            data = json.loads(settings.read_text(encoding="utf-8-sig")) or {}
            for key in ("appsRoot", "devRoot", "suiteRoot", "installRoot"):
                raw = str(data.get(key) or "").strip()
                if raw:
                    p = Path(raw).expanduser()
                    if p.is_dir():
                        roots.append(p.resolve())
        except (OSError, json.JSONDecodeError, TypeError):
            pass

    seen: set[str] = set()
    out: list[Path] = []
    for r in roots:
        key = str(r).lower()
        if key not in seen:
            seen.add(key)
            out.append(r)
    return out


def resolve_suite_app_exe(name: str) -> Path | None:
    app_name = str(name or "").strip()
    if not app_name or any(c in app_name for c in '\\/:*?"<>|'):
        return None
    for root in _suite_candidate_roots():
        folder = root / app_name
        if not folder.is_dir():
            continue
        preferred = folder / f"{app_name}.exe"
        if preferred.is_file():
            return preferred
        # Prefer root-level .exe whose stem matches the app name (case-insensitive)
        matches = [
            p
            for p in folder.glob("*.exe")
            if p.is_file() and p.stem.lower() == app_name.lower()
        ]
        if matches:
            return matches[0]
        # Fallback: first non-uninstaller .exe at folder root
        for p in sorted(folder.glob("*.exe")):
            low = p.name.lower()
            if p.is_file() and "uninstall" not in low and "setup" not in low:
                return p
    return None


def resolve_suite_app_cmd(name: str) -> Path | None:
    """Find a launcher .cmd before a packaged .exe exists."""
    app_name = str(name or "").strip()
    if not app_name or any(c in app_name for c in '\\/:*?"<>|'):
        return None
    candidates = (
        f"{app_name}.cmd",
        "Lancer.cmd",
        f"Lancer {app_name}.cmd",
    )
    for root in _suite_candidate_roots():
        folder = root / app_name
        if not folder.is_dir():
            continue
        for fname in candidates:
            p = folder / fname
            if p.is_file():
                return p
    return None


def resolve_suite_app_python_host(name: str) -> Path | None:
    """Find host/host.py (or host/<name>_host.py) for dev launch."""
    app_name = str(name or "").strip()
    if not app_name or any(c in app_name for c in '\\/:*?"<>|'):
        return None
    for root in _suite_candidate_roots():
        folder = root / app_name
        if not folder.is_dir():
            continue
        for rel in (
            Path("host") / "host.py",
            Path("host") / f"{app_name.lower()}_host.py",
            Path("host.py"),
        ):
            p = folder / rel
            if p.is_file():
                return p
    return None


def launch_suite_app(name: str) -> dict:
    child_env = dict(os.environ)
    child_env[ENV_ACCENT] = (os.environ.get(ENV_ACCENT) or "").strip() or resolve_suite_accent()
    child_env[ENV_LANG] = (os.environ.get(ENV_LANG) or "").strip() or resolve_suite_language()

    exe = resolve_suite_app_exe(name)
    if exe is not None:
        try:
            subprocess.Popen(
                [str(exe)],
                cwd=str(exe.parent),
                shell=False,
                env=child_env,
            )
            return {"ok": True, "path": str(exe)}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    cmd = resolve_suite_app_cmd(name)
    if cmd is not None:
        try:
            subprocess.Popen(
                ["cmd.exe", "/c", str(cmd)],
                cwd=str(cmd.parent),
                shell=False,
                env=child_env,
            )
            return {"ok": True, "path": str(cmd)}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    host_py = resolve_suite_app_python_host(name)
    if host_py is not None:
        try:
            subprocess.Popen(
                [sys.executable, str(host_py)],
                cwd=str(host_py.parent.parent if host_py.parent.name.lower() == "host" else host_py.parent),
                shell=False,
                env=child_env,
            )
            return {"ok": True, "path": str(host_py)}
        except OSError as exc:
            return {"ok": False, "error": str(exc)}

    return {"ok": False, "error": f"Application introuvable: {name}"}


def main() -> None:
    if "--no-elevate" not in sys.argv:
        if elevate_self():
            sys.exit(0)

    root = app_dir()
    index = ui_dir() / "index.html"
    if not index.is_file():
        raise SystemExit(f"UI introuvable: {index}")

    api = Api(root)
    webview.create_window(
        title="Opti",
        url=index.as_uri(),
        js_api=api,
        width=1180,
        height=780,
        min_size=(900, 600),
        background_color="#0b0b0d",
    )
    webview.start(gui="edgechromium", debug=False)


if __name__ == "__main__":
    main()
