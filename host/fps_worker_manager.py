"""Manage isolated fps_worker subprocess from Opti host (crash-safe)."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from pathlib import Path
from typing import Any

CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
SAMPLE_TIMEOUT = 3.0


def _empty_error(msg: str) -> dict[str, Any]:
    return {
        "ok": False,
        "available": False,
        "fps": None,
        "frametimeMs": None,
        "onePercentLow": None,
        "app": None,
        "error": msg,
        "source": "presentmon",
    }


class FpsWorkerManager:
    def __init__(self, root: Path) -> None:
        self._root = root
        self._lock = threading.Lock()
        self._proc: subprocess.Popen[str] | None = None
        self._io_lock = threading.Lock()
        self._clients = 0

    def _worker_cmd(self) -> list[str]:
        if getattr(sys, "frozen", False):
            return [sys.executable, "--fps-worker"]
        worker = Path(__file__).resolve().parent / "fps_worker.py"
        return [sys.executable, str(worker)]

    def _spawn(self) -> None:
        self._kill_worker()
        env = os.environ.copy()
        env["OPTI_ROOT"] = str(self._root)
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"
        host_dir = str(Path(__file__).resolve().parent)
        env["PYTHONPATH"] = host_dir + os.pathsep + env.get("PYTHONPATH", "")
        try:
            self._proc = subprocess.Popen(
                self._worker_cmd(),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                bufsize=1,
                cwd=str(self._root),
                env=env,
                creationflags=CREATE_NO_WINDOW,
            )
        except OSError as exc:
            self._proc = None
            raise RuntimeError(str(exc)) from exc

    def _kill_worker(self) -> None:
        proc = self._proc
        self._proc = None
        if proc is None:
            return
        try:
            if proc.stdin:
                try:
                    proc.stdin.write(json.dumps({"cmd": "shutdown"}) + "\n")
                    proc.stdin.flush()
                except Exception:
                    pass
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=2)
        except Exception:
            pass

    def start(self) -> dict[str, Any]:
        return self.acquire()

    def stop(self) -> dict[str, Any]:
        return self.release()

    def acquire(self) -> dict[str, Any]:
        with self._lock:
            self._clients += 1
            if self._clients > 1:
                return {"ok": True, "running": True}
            try:
                if self._proc is None or self._proc.poll() is not None:
                    self._spawn()
                return {"ok": True, "running": True}
            except Exception as exc:
                self._clients = max(0, self._clients - 1)
                return {"ok": False, "error": str(exc)}

    def release(self) -> dict[str, Any]:
        with self._lock:
            if self._clients <= 0:
                return {"ok": True, "running": False}
            self._clients -= 1
            if self._clients > 0:
                return {"ok": True, "running": True}
            self._kill_worker()
            return {"ok": True, "running": False}

    def _request(self, cmd: str) -> dict[str, Any]:
        with self._io_lock:
            proc = self._proc
            if proc is None or proc.poll() is not None:
                self._spawn()
                proc = self._proc
            if proc is None or proc.stdin is None or proc.stdout is None:
                return _empty_error("Worker FPS indisponible")
            try:
                proc.stdin.write(json.dumps({"cmd": cmd}) + "\n")
                proc.stdin.flush()
                line = proc.stdout.readline()
                if not line:
                    self._kill_worker()
                    return _empty_error("Worker FPS sans réponse")
                return json.loads(line)
            except json.JSONDecodeError:
                self._kill_worker()
                return _empty_error("Réponse worker invalide")
            except Exception as exc:
                self._kill_worker()
                return _empty_error(str(exc))

    def get_sample(self) -> dict[str, Any]:
        with self._lock:
            if self._proc is None or self._proc.poll() is not None:
                try:
                    self._spawn()
                except Exception as exc:
                    return _empty_error(str(exc))
            return self._request("sample")
