#!/usr/bin/env python3
from __future__ import annotations

import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(os.environ.get("LX_TERMINOLOGY_EDITOR_STATIC_ROOT", Path(__file__).resolve().parent)).resolve()
HOST = os.environ.get("LX_TERMINOLOGY_EDITOR_HOST", "127.0.0.1")
PORT = int(os.environ.get("LX_TERMINOLOGY_EDITOR_PORT", "4173"))


class AppHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    handler = partial(AppHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    print(f"Server läuft auf http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
