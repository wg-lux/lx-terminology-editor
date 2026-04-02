# LX Terminology Editor

Static frontend for creating and sharing LX-style terminology YAML bundles.

This repository is vendored into `endoreg-db` at:

- `lx-terminology-editor/`

## Structure

- `src/models/`: terminology module definitions, config loading, normalization, validation
- `src/utils/`: YAML serialization, URL sharing, downloads, local persistence
- `src/store.js`: central state container with subscription and mutation helpers
- `src/ui/`: DOM rendering and event wiring
- `src/main.js`: browser entry point

## Quick Start (with Nix / `devenv`)

From the `endoreg-db` repository root:

```bash
cd lx-terminology-editor
direnv allow   # optional, if you use direnv
devenv shell
python server.py
```

Then open:

```text
http://localhost:4173
```

Alternative:

```bash
cd lx-terminology-editor
devenv up
```

That uses the configured `editor-server` process from `devenv.nix`.

## Run Without Nix

Für die UI alleine reicht ein statischer Server. Für den eingebauten `ok`-Lint-Knopf
verwende den lokalen Python-Server aus diesem Repo:

```bash
python3 server.py
```

Dann `http://localhost:4173` öffnen.

## What The Server Does

The local server:

- serves the frontend on port `4173`
- writes temporary YAML files for linting
- calls the KB linter from the vendored `lx-data-models`
- can publish the current bundle locally under `.published/`
- updates `.published/kb_registry.json`
- can optionally publish directly into an existing knowledge-base data root

For the linter path, `devenv.nix` sets:

```bash
PYTHONPATH=./lx-data-models
```

## Current scope

- Edits bundle metadata and six terminology modules:
  - `lx_examinations`
  - `lx_findings`
  - `lx_interventions`
  - `lx_classifications`
  - `lx_classification_choices`
  - `lx_units`
  - `lx_descriptors`
- Generates:
  - root `config.yaml`
  - per-module `config.yaml`
  - per-module `data/*.yaml`
- Persists state in `localStorage`
- Encodes shareable state in the URL hash
- Downloads generated YAML files individually
- Exports and imports complete terminology bundles as `.zip`
- Führt `ok`/`scripts/lint_kb_yaml.py` über einen lokalen API-Endpoint gegen das aktuelle Bundle aus
- Veröffentlicht das aktuelle Bundle lokal nach `.published/<publish-name>/<version>/`
- Aktualisiert dabei automatisch `.published/kb_registry.json`

## Notes

Der Lint-Button schreibt das aktuelle Bundle temporär und ruft dann den
Knowledge-Base-Linter in `lx-data-models` auf. Das ersetzt noch keine
schema-basierte Validierung direkt im Browser.

Der Publish-Button schreibt das aktuelle Bundle dauerhaft nach `.published/`
und ergänzt die lokale KB-Registry, sodass das Ergebnis direkt als
`LX_DTYPES_KB_REGISTRY`-Quelle verwendet werden kann.

Optional kann stattdessen ein bestehender KB-Zielordner direkt beschrieben
werden:

```bash
export LX_TERMINOLOGY_EDITOR_TARGET_DATA_ROOT=/absolute/path/to/lx_dtypes/data/terminology
```

Dann schreibt der Publish-Button direkt in diesen Ordner. Ohne diese
Env-Variable bleibt das bisherige `.published/`-Verhalten unverändert.

## Published Output

Publishing writes bundle data to:

```text
.published/<publish-name>/<version>/
```

and updates:

```text
.published/kb_registry.json
```

That registry can be used by downstream services that expect an
`LX_DTYPES_KB_REGISTRY` source.

If `LX_TERMINOLOGY_EDITOR_TARGET_DATA_ROOT` is set, publishing writes directly
to that target root instead and does not update `.published/kb_registry.json`.
This is intended for local monorepo integration, for example when `lx-data-models`
or another wrapper environment wants the editor to update a vendored KB folder
in place.

## Standalone Clone

If you work on the editor outside this monorepo:

```bash
git clone git@github.com:wg-lux/lx-terminology-editor.git
cd lx-terminology-editor
direnv allow   # optional
devenv shell
python server.py
```
