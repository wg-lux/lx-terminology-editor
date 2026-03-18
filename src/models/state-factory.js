import { MODULE_DEFINITIONS, normalizeSelectedModules } from "./module-definitions.js";

export function createDefaultDocument(moduleKey, name = "custom.yaml") {
  return {
    id: `${moduleKey}-${Math.random().toString(36).slice(2, 10)}`,
    name,
  };
}

export function createEmptyRecord(moduleDefinition) {
  return moduleDefinition.fields.reduce((record, fieldDefinition) => {
    if (fieldDefinition.type === "tags") {
      record[fieldDefinition.key] = [];
    } else if (fieldDefinition.type === "select") {
      record[fieldDefinition.key] = fieldDefinition.options[0];
    } else {
      record[fieldDefinition.key] = "";
    }
    return record;
  }, {});
}

export function createDefaultState() {
  const state = {
    bundle: {
      name: "example_terminology",
      description: "Shared terminology bundle for LX-compatible YAML exports.",
      version: "0.1.0",
      modules: normalizeSelectedModules(MODULE_DEFINITIONS.map((moduleDefinition) => moduleDefinition.key)),
    },
    documents: {},
    records: {},
  };

  MODULE_DEFINITIONS.forEach((moduleDefinition) => {
    state.documents[moduleDefinition.key] = [createDefaultDocument(moduleDefinition.key)];
    state.records[moduleDefinition.key] = [];
  });

  state.records.lx_examinations = [
    {
      _documentId: state.documents.lx_examinations[0].id,
      name: "colonoscopy",
      description: "Colonoscopy examination.",
      examination_types: ["endoscopic_procedure"],
      findings: ["colon_polyp", "colon_inflammation"],
      indications: ["colonoscopy_screening"],
    },
  ];

  state.records.lx_findings = [
    {
      _documentId: state.documents.lx_findings[0].id,
      name: "colon_polyp",
      description: "Polyp",
      finding_types: ["observation"],
    },
  ];

  state.records.lx_interventions = [
    {
      _documentId: state.documents.lx_interventions[0].id,
      name: "egd_stepwise_biopsy",
      description: "",
      intervention_types: [],
    },
  ];

  state.records.lx_classifications = [
    {
      _documentId: state.documents.lx_classifications[0].id,
      name: "colon_lesion_paris",
      name_de: "Formklassifikation Kolonlaesion",
      name_en: "Colon Lesion Shape Classification",
      classification_types: ["morphology"],
      classification_choices: ["colon_lesion_paris_Is", "colon_lesion_paris_IIa"],
    },
  ];

  state.records.lx_classification_choices = [
    {
      _documentId: state.documents.lx_classification_choices[0].id,
      name: "terminal_ileum",
      name_de: "",
      name_en: "Terminal ileum",
      description: "",
    },
  ];

  state.records.lx_units = [
    {
      _documentId: state.documents.lx_units[0].id,
      name: "minutes",
      abbreviation: "min",
      name_de: "Minuten",
      name_en: "Minutes",
      description: "Time unit for durations and numeric time values.",
      unit_types: ["time"],
    },
    {
      _documentId: state.documents.lx_units[0].id,
      name: "millimeter",
      abbreviation: "mm",
      name_de: "Millimeter",
      name_en: "Millimeter",
      description: "Length unit for sizes such as lesion diameter.",
      unit_types: ["length"],
    },
  ];

  state.records.lx_descriptors = [
    {
      _documentId: state.documents.lx_descriptors[0].id,
      name: "minutes_numeric_value",
      description: "Numeric value representing minutes.",
      unit: "minutes",
      classification_choice_descriptor_type: "numeric",
    },
  ];

  return state;
}
