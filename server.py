#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import tempfile
import importlib.util
import importlib
from http import HTTPStatus
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
LX_DATA_MODELS_ROOT = ROOT / "lx-data-models"
KB_LINT_MODULE_PATH = LX_DATA_MODELS_ROOT / "lx_kb_lint.py"
PORT = 4173
RECORD_PASSTHROUGH_KEY = "_passthrough"
PUBLISHED_ROOT = ROOT / ".published"


def normalize_state(candidate: dict) -> dict:
    bundle = candidate.get("bundle", {})
    publish = candidate.get("publish", {})
    documents = candidate.get("documents", {})
    records = candidate.get("records", {})
    publish_name = str(publish.get("name", bundle.get("name", "example_terminology"))).strip()
    return {
        "bundle": {
            "name": bundle.get("name", "example_terminology"),
            "description": bundle.get("description", ""),
            "version": bundle.get("version", "0.1.0"),
            "modules": list(bundle.get("modules", [])),
        },
        "publish": {
            "name": publish_name or str(bundle.get("name", "example_terminology")).strip() or "example_terminology",
        },
        "documents": documents if isinstance(documents, dict) else {},
        "records": records if isinstance(records, dict) else {},
    }


def scalar_to_yaml(value: object) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    string_value = str(value)
    if string_value == "":
        return '""'
    if all(character.isalnum() or character in "_./-" for character in string_value):
        return string_value
    return json.dumps(string_value)


def to_yaml(value: object, depth: int = 0) -> str:
    indent = "  " * depth
    if isinstance(value, list):
        if not value:
            return "[]\n"
        lines: list[str] = []
        for item in value:
            if isinstance(item, (dict, list)):
                if isinstance(item, dict) and item:
                    items = list(item.items())
                    first_key, first_value = items[0]
                    block = f"{indent}- {first_key}:{format_object_value(first_value, depth)}"
                    for key, entry in items[1:]:
                        block += f"\n{indent}  {key}:{format_object_value(entry, depth + 1)}"
                    lines.append(block)
                else:
                    lines.append(f"{indent}-\n{to_yaml(item, depth + 1).rstrip()}")
            else:
                lines.append(f"{indent}- {scalar_to_yaml(item)}")
        return "\n".join(lines) + "\n"

    if isinstance(value, dict):
        if not value:
            return "{}\n"
        return (
            "\n".join(f"{indent}{key}:{format_object_value(entry, depth)}" for key, entry in value.items())
            + "\n"
        )

    return f"{scalar_to_yaml(value)}\n"


def format_object_value(value: object, depth: int) -> str:
    if isinstance(value, (dict, list)):
        return f"\n{to_yaml(value, depth + 1).rstrip()}"
    return f" {scalar_to_yaml(value)}"


def prune_empty(value: object) -> object:
    if isinstance(value, list):
        return [item for item in (prune_empty(item) for item in value) if item not in (None, "", [], {})]
    if isinstance(value, dict):
        result = {}
        for key, entry in value.items():
            cleaned = prune_empty(entry)
            if cleaned in (None, "", [], {}):
                continue
            result[key] = cleaned
        return result
    return value


def build_file_map(state: dict) -> dict[str, str]:
    bundle = state["bundle"]
    file_map: dict[str, str] = {
        "config.yaml": to_yaml(
            prune_empty(
                {
                    "name": bundle["name"],
                    "description": bundle["description"],
                    "version": bundle["version"],
                    "modules": bundle["modules"],
                }
            )
        )
    }

    module_defaults = {
        "lx_examinations": {"model": "examination", "depends_on": ["lx_findings", "lx_interventions"]},
        "lx_findings": {"model": "finding", "depends_on": ["lx_classifications"]},
        "lx_interventions": {"model": "intervention", "depends_on": []},
        "lx_classifications": {"model": "classification", "depends_on": ["lx_classification_choices"]},
        "lx_classification_choices": {"model": "classification_choice", "depends_on": ["lx_descriptors"]},
        "lx_units": {"model": "unit", "depends_on": []},
        "lx_descriptors": {"model": "classification_choice_descriptor", "depends_on": ["lx_units"]},
    }

    for module_key in bundle["modules"]:
        defaults = module_defaults[module_key]
        file_map[f"{module_key}/config.yaml"] = to_yaml(
            prune_empty(
                {
                    "name": module_key,
                    "description": "",
                    "version": "0.1.0",
                    "depends_on": defaults["depends_on"],
                    "data": {"dirs": ["./data"]},
                }
            )
        )
        documents = state["documents"].get(module_key) or [{"id": f"{module_key}-default", "name": "custom.yaml"}]
        for document in documents:
            file_map[f"{module_key}/data/{document['name']}"] = to_yaml(
                [
                    prune_empty(
                        {
                            "model": defaults["model"],
                            **record,
                            **(
                                record.get(RECORD_PASSTHROUGH_KEY)
                                if isinstance(record.get(RECORD_PASSTHROUGH_KEY), dict)
                                else {}
                            ),
                            "_documentId": None,
                            RECORD_PASSTHROUGH_KEY: None,
                        }
                    )
                    for record in state["records"].get(module_key, [])
                    if record.get("_documentId") in (None, document["id"])
                ]
            )

    return file_map


def run_lint(state: dict) -> dict[str, object]:
    normalized_state = normalize_state(state)
    temp_root = Path(tempfile.mkdtemp(prefix="lx-terminology-editor-"))
    try:
        file_map = build_file_map(normalized_state)
        for relative_path, content in file_map.items():
            target = temp_root / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        config_path = temp_root / "config.yaml"
        linter = load_kb_linter()
        yaml_files, discovery_issues = linter.discover_yaml_files(paths=[], config_paths=[config_path])
        lint_issues = linter.lint_kb_yaml_files(yaml_files)
        all_issues = [*discovery_issues, *lint_issues]
        summary = linter.summarize_issues(all_issues)
        output_lines = [issue.format() for issue in all_issues]
        output_lines.append(
            f"\nScanned {len(yaml_files)} YAML file(s): {summary['errors']} error(s), {summary['warnings']} warning(s)."
        )
        returncode = 1 if summary["errors"] > 0 else 0
        summary_text = (
            "Lint erfolgreich."
            if returncode == 0 and summary["warnings"] == 0
            else f"Lint abgeschlossen: {summary['errors']} Fehler, {summary['warnings']} Warnungen."
        )
        return {
            "ok": returncode == 0,
            "returncode": returncode,
            "summary_text": summary_text,
            "output": "\n".join(output_lines).strip() or "Keine Ausgabe.",
        }
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


def publish_bundle(state: dict) -> dict[str, object]:
    normalized_state = normalize_state(state)
    file_map = build_file_map(normalized_state)
    module_name = str(normalized_state["bundle"]["name"]).strip() or "example_terminology"
    version = str(normalized_state["bundle"]["version"]).strip() or "0.1.0"
    publish_name = str(normalized_state["publish"]["name"]).strip() or module_name

    target_root = (PUBLISHED_ROOT / publish_name / version).resolve()
    registry_path = (PUBLISHED_ROOT / "kb_registry.json").resolve()

    if target_root.exists():
        shutil.rmtree(target_root)
    target_root.mkdir(parents=True, exist_ok=True)

    for relative_path, content in file_map.items():
        target = target_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    if registry_path.exists():
        registry_payload = json.loads(registry_path.read_text(encoding="utf-8"))
    else:
        registry_payload = {"modules": {}}

    modules = registry_payload.setdefault("modules", {})
    module_versions = modules.setdefault(module_name, {})
    module_versions[version] = {
        "input_dirs": [str(target_root)],
    }
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(
        json.dumps(registry_payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    return {
        "ok": True,
        "summary_text": f"{module_name}@{version} veröffentlicht.",
        "output": (
            f"Publish name: {publish_name}\n"
            f"Module: {module_name}\n"
            f"Version: {version}\n"
            f"Published root: {target_root}\n"
            f"Registry: {registry_path}"
        ),
        "publish_name": publish_name,
        "module_name": module_name,
        "version": version,
        "published_root": str(target_root),
        "registry_path": str(registry_path),
    }


def load_kb_linter():
    try:
        return importlib.import_module("lx_kb_lint")
    except ModuleNotFoundError as error:
        if error.name != "lx_kb_lint":
            missing_module = error.name or "unbekannt"
            raise RuntimeError(
                "Die Python-Abhaengigkeiten fuer den KB-Linter fehlen in der aktuellen Umgebung. "
                f"Fehlendes Modul: {missing_module}. "
                "Starte den Server im lx-data-models/devenv-Kontext oder installiere die Abhaengigkeiten dort."
            ) from error

    spec = importlib.util.spec_from_file_location("lx_kb_yaml_lint_runtime", KB_LINT_MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Konnte Lint-Modul nicht laden: {KB_LINT_MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)
    except ModuleNotFoundError as error:
        missing_module = error.name or "unbekannt"
        raise RuntimeError(
            "Die Python-Abhaengigkeiten fuer den KB-Linter fehlen in der aktuellen Umgebung. "
            f"Fehlendes Modul: {missing_module}. "
            "Starte den Server im lx-data-models/devenv-Kontext oder installiere die Abhaengigkeiten dort."
        ) from error
    return module


class AppHandler(SimpleHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path not in {"/api/lint", "/api/publish"}:
            self.send_error(HTTPStatus.NOT_FOUND, "Unbekannter Endpoint")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(raw_body or "{}")
            if self.path == "/api/publish":
                result = publish_bundle(payload.get("state", {}))
            else:
                result = run_lint(payload.get("state", {}))
            self._send_json(HTTPStatus.OK, result)
        except Exception as error:  # pragma: no cover - local dev endpoint
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {
                    "error": str(error),
                    "output": str(error),
                    "summary_text": (
                        "Publish-Aufruf fehlgeschlagen."
                        if self.path == "/api/publish"
                        else "Lint-Aufruf fehlgeschlagen."
                    ),
                },
            )

    def log_message(self, format: str, *args: object) -> None:
        return

    def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    handler = partial(AppHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"Server läuft auf http://127.0.0.1:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
