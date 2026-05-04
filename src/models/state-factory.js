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
    } else if (fieldDefinition.type === "number") {
      record[fieldDefinition.key] = "";
    } else if (fieldDefinition.type === "boolean") {
      record[fieldDefinition.key] = false;
    } else if (fieldDefinition.type === "json") {
      record[fieldDefinition.key] = {};
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
      name: "beispiel_terminologie",
      description: "Gemeinsames Terminologiepaket für LX-kompatible YAML-Exporte.",
      version: "0.1.0",
      medical_field: "gastroenterology",
      author: "",
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
      description: "Koloskopie-Untersuchung.",
      examination_types: ["endoscopic_procedure"],
      findings: ["colon_polyp", "colon_inflammation"],
      indications: ["colonoscopy_screening"],
    },
  ];

  state.records.lx_findings = [
    {
      _documentId: state.documents.lx_findings[0].id,
      name: "colon_polyp",
      name_de: "Kolonpolyp",
      name_en: "Colon polyp",
      description: "Polyp",
      finding_types: ["observation"],
      classifications: ["colon_lesion_paris"],
      interventions: ["egd_stepwise_biopsy"],
      caused_by_interventions: [],
    },
  ];

  state.records.lx_indications = [
    {
      _documentId: state.documents.lx_indications[0].id,
      name: "colonoscopy_screening",
      name_de: "Vorsorgekoloskopie",
      name_en: "Screening colonoscopy",
      description: "Indikation für eine Vorsorgeuntersuchung.",
      indication_types: ["screening"],
      classifications: [],
      interventions: [],
    },
  ];

  state.records.lx_interventions = [
    {
      _documentId: state.documents.lx_interventions[0].id,
      name: "egd_stepwise_biopsy",
      name_de: "Schrittweise Biopsie",
      name_en: "Stepwise biopsy",
      description: "",
      classifications: ["colon_lesion_paris"],
      intervention_types: [],
    },
  ];

  state.records.lx_classifications = [
    {
      _documentId: state.documents.lx_classifications[0].id,
      name: "colon_lesion_paris",
      name_de: "Formklassifikation Kolonläsion",
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
      classification_choice_descriptors: ["minutes_numeric_value"],
    },
  ];

  state.records.lx_units = [
    {
      _documentId: state.documents.lx_units[0].id,
      name: "minutes",
      abbreviation: "min",
      name_de: "Minuten",
      name_en: "Minutes",
      description: "Zeiteinheit für Dauerangaben und numerische Zeitwerte.",
      unit_types: ["time"],
    },
    {
      _documentId: state.documents.lx_units[0].id,
      name: "millimeter",
      abbreviation: "mm",
      name_de: "Millimeter",
      name_en: "Millimeter",
      description: "Längeneinheit für Größenangaben wie Läsionsdurchmesser.",
      unit_types: ["length"],
    },
  ];

  state.records.lx_descriptors = [
    {
      _documentId: state.documents.lx_descriptors[0].id,
      name: "minutes_numeric_value",
      description: "Numerischer Wert in Minuten.",
      unit: "minutes",
      classification_choice_descriptor_type: "numeric",
      numeric_min: 0,
      numeric_max: 240,
      numeric_distribution: "uniform",
      numeric_distribution_params: { low: 0, high: 240 },
      text_max_length: "",
      default_value_str: "",
      default_value_num: 0,
      default_value_bool: false,
      selection_options: [],
      selection_multiple: false,
      selection_multiple_n_min: "",
      selection_multiple_n_max: "",
      selection_default_options: {},
    },
  ];

  return state;
}
