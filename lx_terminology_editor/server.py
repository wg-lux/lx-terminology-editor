from __future__ import annotations

import os
from importlib.metadata import PackageNotFoundError, distribution
from pathlib import Path


def _packaged_static_root() -> Path:
    try:
        dist = distribution("lx-terminology-editor")
    except PackageNotFoundError:
        dist = None

    if dist is not None:
        for entry in dist.files or []:
            if str(entry).endswith("share/lx-terminology-editor/index.html"):
                return Path(dist.locate_file(entry)).parent

    source_root = Path(__file__).resolve().parent.parent
    if (source_root / "index.html").is_file():
        return source_root

    raise RuntimeError("Packaged LX terminology editor static assets were not found.")


os.environ.setdefault("LX_TERMINOLOGY_EDITOR_STATIC_ROOT", str(_packaged_static_root()))

from server import main  # noqa: E402


__all__ = ["main"]
