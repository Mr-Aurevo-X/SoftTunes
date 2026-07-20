"""Copy soft-minified app.js into dist staging only — keep ui/app.js readable for git."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ui" / "app.js"
STAGE = ROOT / "build" / "ui_stage"


def minify(text: str) -> str:
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    lines = []
    for line in text.splitlines():
        if line.lstrip().startswith("//"):
            continue
        lines.append(line.rstrip())
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"missing {SRC}")
    if STAGE.exists():
        shutil.rmtree(STAGE)
    shutil.copytree(ROOT / "ui", STAGE)
    app = STAGE / "app.js"
    app.write_text(minify(SRC.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"staged minified UI -> {STAGE}")


if __name__ == "__main__":
    main()
