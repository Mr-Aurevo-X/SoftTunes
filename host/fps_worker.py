# Copyright (c) 2026 Mr-Aurevo-X. All rights reserved.
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Author: Mr-Aurevo-X | https://github.com/Mr-Aurevo-X

"""Isolated FPS capture worker — JSON lines on stdin/stdout."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from presentmon_reader import PresentMonSession


def _root_dir() -> Path:
    env = (os.environ.get("OPTI_ROOT") or "").strip()
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stdin, "reconfigure"):
        try:
            sys.stdin.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    root = _root_dir()
    session = PresentMonSession(root)
    session.start()
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
            except json.JSONDecodeError:
                print(json.dumps({"ok": False, "error": "invalid json"}), flush=True)
                continue
            cmd = (req.get("cmd") or "").strip().lower()
            if cmd == "sample":
                print(json.dumps(session.sample(), ensure_ascii=False), flush=True)
            elif cmd == "ping":
                print(json.dumps({"ok": True, "pong": True}), flush=True)
            elif cmd == "shutdown":
                break
            else:
                print(json.dumps({"ok": False, "error": f"unknown cmd: {cmd}"}), flush=True)
    finally:
        session.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
