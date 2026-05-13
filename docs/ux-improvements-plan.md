# UX Improvements Plan

## Summary

This note is the implementation reference for the editor UX improvements. The work keeps all terminology data local to the browser and does not change the exported LX YAML shape.

Implemented UX goals:

- Collapsible fields with important fields open by default.
- Local concept search over the current package.
- Sticky preview/actions on desktop.
- A separate empty reset action for starting from zero instead of restoring the example.
- ZIP download and package check in the preview action area.
- A persistent "Neuer Eintrag" action for the active module.
- Chip-based list editing for CSV-style fields.
- Derived suggestions for missing findings.
- Helper text hidden behind an info button unless a validation error is present.
- A preview tree for generated files and hierarchical concept references.

## Key Behavior

- Concept search indexes record names, German and English labels, descriptions, module labels, document names, and list-field references from the current editor state.
- Missing finding suggestions are derived from finding references in examinations, report templates, and report sections.
- List fields still store arrays and export exactly like before; the chip UI only replaces comma-only text editing.
- The preview navigator contains both generated files and concept references ordered by the hierarchy:
  `Examination -> Finding / Intervention -> Classification -> ClassificationChoice -> ClassificationDescriptor -> Unit`.

## Implementation Notes

- `src/store.js` exposes `addRecordWithValues()` for seeded records.
- `src/models/module-definitions.js` adds optional `sourceModule` metadata for list fields that can autocomplete existing concepts.
- `src/ui/app-ui.js` owns local UI state for collapsed fields, helper text, tree expansion, search, and focused records.
- `styles.css` contains the responsive sticky behavior. Sticky preview is disabled when the layout becomes single-column.

## Acceptance Checks

- Untouched default package exports the same YAML data.
- Chip input can add comma-separated values, paste CSV-like text, delete individual values, and preserve order.
- Selecting a search result or tree concept opens the matching module, document, and record.
- Selecting a data file in the tree syncs the active module and document.
- Missing finding suggestions create seeded `lx_findings` records and disappear after creation.
- ZIP download and package check remain available from the preview area.
