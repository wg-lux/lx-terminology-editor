# LX Terminology Editor

Static frontend for creating and sharing LX-style terminology YAML bundles.

## Structure

- `src/models/`: terminology module definitions, config loading, normalization, validation
- `src/utils/`: YAML serialization, URL sharing, downloads, local persistence
- `src/store.js`: central state container with subscription and mutation helpers
- `src/ui/`: DOM rendering and event wiring
- `src/main.js`: browser entry point

## Run

Für die UI alleine reicht ein statischer Server. Für den eingebauten `ok`-Lint-Knopf
verwende den lokalen Python-Server aus diesem Repo:

```bash
python3 server.py
```

Dann `http://localhost:4173` öffnen.

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
