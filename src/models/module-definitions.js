const VALIDATOR_OPERATOR_OPTIONS = ["exists", "missing", "condition"];
const VALIDATOR_PRECEDENCE_OPTIONS = ["required", "optional"];
const NUMERIC_DISTRIBUTION_OPTIONS = ["unknown", "uniform", "normal", "log_normal", "exponential"];

export const MODULE_DEFINITIONS = [
  {
    key: "lx_examinations",
    label: "Untersuchungen",
    model: "examination",
    description: "Untersuchungstypen, die Befunde, Indikationen und Prozeduren verbinden.",
    dependsOn: ["lx_findings", "lx_interventions", "lx_indications"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colonoscopy", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Koloskopie" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Colonoscopy" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Koloskopie-Untersuchung.",
      },
      {
        key: "examination_types",
        label: "Untersuchungstypen",
        type: "tags",
        placeholder: "endoscopic_procedure",
      },
      { key: "findings", label: "Befunde", type: "tags", sourceModule: "lx_findings", placeholder: "colon_polyp" },
      {
        key: "indications",
        label: "Indikationen",
        type: "tags",
        sourceModule: "lx_indications",
        placeholder: "colonoscopy_screening",
      },
    ],
  },
  {
    key: "lx_findings",
    label: "Befunde",
    model: "finding",
    description: "Terminologie-Befunde, die innerhalb einer Untersuchung auftreten können.",
    dependsOn: ["lx_classifications", "lx_interventions"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "gastroscopy_polyp", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Polyp" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Polyp" },
      { key: "description", label: "Beschreibung", type: "textarea", placeholder: "Polyp" },
      { key: "finding_types", label: "Befundtypen", type: "tags", placeholder: "observation" },
      {
        key: "classifications",
        label: "Klassifikationen",
        type: "tags",
        sourceModule: "lx_classifications",
        placeholder: "size_mm",
      },
      {
        key: "interventions",
        label: "Interventionen",
        type: "tags",
        sourceModule: "lx_interventions",
        placeholder: "endoscopy_hemoclip_generic",
      },
      {
        key: "caused_by_interventions",
        label: "Verursachende Interventionen",
        type: "tags",
        sourceModule: "lx_interventions",
        placeholder: "prior_polypectomy",
      },
      {
        key: "matching_findings_validators",
        label: "Passende Befund-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_findings_validators",
        matchField: "finding",
        computed: true,
        editorOnly: true,
      },
      {
        key: "matching_classification_validators",
        label: "Passende Klassifikations-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_classification_validators",
        matchField: "finding",
        computed: true,
        editorOnly: true,
      },
      {
        key: "matching_intervention_validators",
        label: "Passende Interventions-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_intervention_validators",
        matchField: "finding",
        computed: true,
        editorOnly: true,
      },
      {
        key: "matching_unit_validators",
        label: "Passende Einheiten-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_unit_validators",
        matchField: "finding",
        computed: true,
        editorOnly: true,
      },
    ],
  },
  {
    key: "lx_indications",
    label: "Indikationen",
    model: "indication",
    description: "Terminologie-Indikationen für Untersuchungen, Verlaufskontrollen und klinische Kontexte.",
    dependsOn: ["lx_classifications", "lx_interventions"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colonoscopy_screening", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Vorsorgekoloskopie" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Screening colonoscopy" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Beschreibung der Indikation.",
      },
      { key: "indication_types", label: "Indikationstypen", type: "tags", placeholder: "screening" },
      {
        key: "classifications",
        label: "Klassifikationen",
        type: "tags",
        sourceModule: "lx_classifications",
        placeholder: "size_mm",
      },
      {
        key: "interventions",
        label: "Interventionen",
        type: "tags",
        sourceModule: "lx_interventions",
        placeholder: "endoscopy_hemoclip_generic",
      },
    ],
  },
  {
    key: "lx_interventions",
    label: "Interventionen",
    model: "intervention",
    description: "Verfügbare Maßnahmen oder Prozeduren, die mit Befunden verknüpft werden können.",
    dependsOn: ["lx_classifications"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "egd_stepwise_biopsy", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Schrittweise Biopsie" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Stepwise biopsy" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Beschreibung der Intervention.",
      },
      {
        key: "classifications",
        label: "Klassifikationen",
        type: "tags",
        sourceModule: "lx_classifications",
        placeholder: "size_mm",
      },
      { key: "intervention_types", label: "Interventionstypen", type: "tags", placeholder: "therapeutic" },
      {
        key: "matching_intervention_validators",
        label: "Passende Interventions-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_intervention_validators",
        matchField: "intervention",
        computed: true,
        editorOnly: true,
      },
    ],
  },
  {
    key: "lx_classifications",
    label: "Klassifikationen",
    model: "classification",
    description: "Strukturierte Dimensionen wie Morphologie oder Lokalisation mit erlaubten Auswahlwerten.",
    dependsOn: ["lx_classification_choices"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colon_lesion_paris", required: true },
      {
        key: "name_de",
        label: "Deutsche Bezeichnung",
        type: "text",
        placeholder: "Formklassifikation Kolonläsion",
      },
      {
        key: "name_en",
        label: "Englische Bezeichnung",
        type: "text",
        placeholder: "Colon Lesion Shape Classification",
      },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Beschreibung der Klassifikation.",
      },
      {
        key: "classification_types",
        label: "Klassifikationstypen",
        type: "tags",
        placeholder: "morphology",
      },
      {
        key: "classification_choices",
        label: "Klassifikations-Auswahlwerte",
        type: "tags",
        sourceModule: "lx_classification_choices",
        placeholder: "colon_lesion_paris_Is",
      },
      {
        key: "matching_classification_validators",
        label: "Passende Klassifikations-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_classification_validators",
        matchField: "classification",
        computed: true,
        editorOnly: true,
      },
      {
        key: "matching_unit_validators",
        label: "Passende Einheiten-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_unit_validators",
        matchField: "classification",
        computed: true,
        editorOnly: true,
      },
    ],
  },
  {
    key: "lx_classification_choices",
    label: "Auswahlwerte",
    model: "classification_choice",
    description: "Atomare Werte, aus denen Klassifikationen aufgebaut werden.",
    dependsOn: ["lx_descriptors"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "terminal_ileum", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Terminales Ileum" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Terminal ileum" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Hinweise zum Auswahlwert.",
      },
      {
        key: "classification_choice_descriptors",
        label: "Deskriptoren",
        type: "tags",
        sourceModule: "lx_descriptors",
        placeholder: "length_mm_descriptor",
      },
    ],
  },
  {
    key: "lx_units",
    label: "Einheiten",
    model: "unit",
    description: "Wiederverwendbare Einheiten für numerische Angaben wie Laborwerte, Größen oder Zeitdauern.",
    dependsOn: [],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "millimeter", required: true },
      { key: "abbreviation", label: "Abkürzung", type: "text", placeholder: "mm" },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Millimeter" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Millimeter" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Einheit für Größen- oder Laborangaben.",
      },
      { key: "unit_types", label: "Einheitstypen", type: "tags", placeholder: "length" },
      {
        key: "matching_unit_validators",
        label: "Passende Einheiten-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_unit_validators",
        matchField: "unit",
        computed: true,
        editorOnly: true,
      },
    ],
  },
  {
    key: "lx_descriptors",
    label: "Deskriptoren",
    model: "classification_choice_descriptor",
    description: "Zusätzliche Deskriptordefinitionen wie numerische Einheiten oder Textwerte.",
    dependsOn: ["lx_units"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "minutes_numeric_value", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Numerischer Minutenwert" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Numeric minute value" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Numerischer Wert in Minuten.",
      },
      {
        key: "unit",
        label: "Einheit",
        type: "reference",
        sourceModule: "lx_units",
        placeholder: "Einheit auswählen",
      },
      {
        key: "classification_choice_descriptor_type",
        label: "Deskriptortyp",
        type: "select",
        options: ["numeric", "text", "selection", "boolean"],
      },
      { key: "numeric_min", label: "Minimum", type: "number", placeholder: "0" },
      { key: "numeric_max", label: "Maximum", type: "number", placeholder: "100" },
      {
        key: "numeric_distribution",
        label: "Numerische Verteilung",
        type: "select",
        options: NUMERIC_DISTRIBUTION_OPTIONS,
      },
      {
        key: "numeric_distribution_params",
        label: "Verteilungsparameter",
        type: "numeric-distribution-params",
      },
      { key: "text_max_length", label: "Textlänge Maximum", type: "number", placeholder: "255" },
      { key: "default_value_str", label: "Standardwert Text", type: "text", placeholder: "normal" },
      { key: "default_value_num", label: "Standardwert Zahl", type: "number", placeholder: "0" },
      { key: "default_value_bool", label: "Standardwert Ja/Nein", type: "boolean" },
      { key: "selection_options", label: "Auswahloptionen", type: "tags", placeholder: "adenoma" },
      { key: "selection_multiple", label: "Mehrfachauswahl", type: "boolean" },
      {
        key: "selection_multiple_n_min",
        label: "Mehrfachauswahl Minimum",
        type: "number",
        placeholder: "1",
      },
      {
        key: "selection_multiple_n_max",
        label: "Mehrfachauswahl Maximum",
        type: "number",
        placeholder: "3",
      },
      {
        key: "selection_default_options",
        label: "Standardoptionen",
        type: "selection-default-options",
      },
    ],
  },
  {
    key: "lx_report_template_sections",
    label: "Berichtsabschnitte",
    model: "report_template_section",
    description: "Automatisch erzeugte Abschnitte für die in Berichten ausgewählten Befunde.",
    dependsOn: ["lx_findings"],
    hidden: true,
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colonoscopy_findings_section", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Befunde" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Findings" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Beschreibung des Berichtsabschnitts.",
      },
      { key: "position", label: "Position", type: "number", placeholder: "10" },
      { key: "types", label: "Abschnittstypen", type: "tags", placeholder: "colonoscopy" },
      {
        key: "section_kind",
        label: "Art des Abschnitts",
        type: "select",
        options: ["findings", "patient_data", "history"],
      },
      {
        key: "findings",
        label: "Berichtsbefunde",
        type: "tags",
        sourceModule: "lx_findings",
        placeholder: "colon_polyp_report",
      },
      {
        key: "fields",
        label: "Felder für Patientendaten/Anamnese (JSON-Liste)",
        type: "json-list",
        placeholder: '[{"key":"age","label":"Alter","required":true,"source":"patient"}]',
      },
    ],
  },
  {
    key: "lx_findings_validators",
    label: "Befund-Validatoren",
    model: "findings_validator",
    description: "Regeln, die prüfen, ob ein Befund vorhanden ist oder weitere Angaben auslöst.",
    dependsOn: ["lx_findings", "lx_classifications"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "polyp_has_lst_if_large", required: true },
      {
        key: "finding",
        label: "Befund",
        type: "reference",
        sourceModule: "lx_findings",
        placeholder: "Befund auswählen",
        required: true,
      },
      { key: "operator", label: "Prüfart", type: "select", options: VALIDATOR_OPERATOR_OPTIONS },
      {
        key: "query",
        label: "Regel",
        type: "validator-rule",
      },
    ],
  },
  {
    key: "lx_classification_validators",
    label: "Klassifikations-Validatoren",
    model: "classification_validator",
    description: "Regeln, die Klassifikationen für einen Befund verlangen oder bedingt prüfen.",
    dependsOn: ["lx_findings", "lx_classifications"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "polyp_requires_size", required: true },
      {
        key: "finding",
        label: "Befund",
        type: "reference",
        sourceModule: "lx_findings",
        placeholder: "Befund auswählen",
        required: true,
      },
      {
        key: "classification",
        label: "Klassifikation",
        type: "reference",
        sourceModule: "lx_classifications",
        placeholder: "Klassifikation auswählen",
        required: true,
      },
      { key: "operator", label: "Prüfart", type: "select", options: VALIDATOR_OPERATOR_OPTIONS },
      { key: "precedence", label: "Priorität", type: "select", options: VALIDATOR_PRECEDENCE_OPTIONS },
      {
        key: "query",
        label: "Regel",
        type: "validator-rule",
      },
    ],
  },
  {
    key: "lx_intervention_validators",
    label: "Interventions-Validatoren",
    model: "intervention_validator",
    description: "Regeln, die Interventionen für einen Befund verlangen oder bedingt prüfen.",
    dependsOn: ["lx_findings", "lx_interventions"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "polyp_requires_resection", required: true },
      {
        key: "finding",
        label: "Befund",
        type: "reference",
        sourceModule: "lx_findings",
        placeholder: "Befund auswählen",
        required: true,
      },
      {
        key: "intervention",
        label: "Intervention",
        type: "reference",
        sourceModule: "lx_interventions",
        placeholder: "Intervention auswählen",
        required: true,
      },
      { key: "operator", label: "Prüfart", type: "select", options: VALIDATOR_OPERATOR_OPTIONS },
      { key: "precedence", label: "Priorität", type: "select", options: VALIDATOR_PRECEDENCE_OPTIONS },
      {
        key: "query",
        label: "Regel",
        type: "validator-rule",
      },
    ],
  },
  {
    key: "lx_unit_validators",
    label: "Einheiten-Validatoren",
    model: "unit_validator",
    description: "Regeln, die Einheiten für numerische Klassifikationen verlangen oder prüfen.",
    dependsOn: ["lx_findings", "lx_classifications", "lx_units"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "polyp_size_uses_mm", required: true },
      {
        key: "finding",
        label: "Befund",
        type: "reference",
        sourceModule: "lx_findings",
        placeholder: "Befund auswählen",
        required: true,
      },
      {
        key: "classification",
        label: "Klassifikation",
        type: "reference",
        sourceModule: "lx_classifications",
        placeholder: "Klassifikation auswählen",
        required: true,
      },
      {
        key: "unit",
        label: "Einheit",
        type: "reference",
        sourceModule: "lx_units",
        placeholder: "Einheit auswählen",
        required: true,
      },
      { key: "operator", label: "Prüfart", type: "select", options: VALIDATOR_OPERATOR_OPTIONS },
      { key: "precedence", label: "Priorität", type: "select", options: VALIDATOR_PRECEDENCE_OPTIONS },
      {
        key: "query",
        label: "Regel",
        type: "validator-rule",
      },
    ],
  },
  {
    key: "lx_examination_validators",
    label: "Untersuchungs-Validatoren",
    model: "examination_validator",
    description: "Gruppiert Befund- und Untersuchungsregeln zu einer gemeinsam prüfbaren Regel.",
    dependsOn: ["lx_findings_validators"],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colonoscopy_validator", required: true },
      {
        key: "finding_validators",
        label: "Befund-Validatoren",
        type: "tags",
        sourceModule: "lx_findings_validators",
        placeholder: "polyp_has_lst_if_large",
      },
      {
        key: "examination_validators",
        label: "Weitere Untersuchungs-Validatoren",
        type: "tags",
        sourceModule: "lx_examination_validators",
        placeholder: "base_colonoscopy_validator",
      },
    ],
  },
  {
    key: "lx_report_templates",
    label: "Berichte",
    model: "report_template",
    description: "Berichte verbinden Untersuchung, Befunde und Validatoren.",
    dependsOn: [
      "lx_examinations",
      "lx_report_template_sections",
      "lx_examination_validators",
      "lx_findings_validators",
      "lx_classification_validators",
      "lx_intervention_validators",
      "lx_unit_validators",
    ],
    fields: [
      { key: "name", label: "Name", type: "text", placeholder: "colonoscopy_template", required: true },
      { key: "name_de", label: "Deutsche Bezeichnung", type: "text", placeholder: "Koloskopie-Bericht" },
      { key: "name_en", label: "Englische Bezeichnung", type: "text", placeholder: "Colonoscopy report" },
      {
        key: "description",
        label: "Beschreibung",
        type: "textarea",
        placeholder: "Optionale Beschreibung der Berichtsvorlage.",
      },
      {
        key: "examination",
        label: "Untersuchung",
        type: "reference",
        sourceModule: "lx_examinations",
        placeholder: "Untersuchung auswählen",
        required: true,
      },
      {
        key: "report_findings",
        label: "Befunde im Bericht",
        type: "reference-tags",
        sourceModule: "lx_findings",
        placeholder: "Befund auswählen",
        editorOnly: true,
      },
      {
        key: "report_sections",
        label: "Weitere Berichtsabschnitte",
        type: "tags",
        sourceModule: "lx_report_template_sections",
        placeholder: "history_section",
      },
      {
        key: "examination_validators",
        label: "Untersuchungs-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_examination_validators",
        placeholder: "Untersuchungs-Validator auswählen",
        editorOnly: true,
      },
      {
        key: "findings_validators",
        label: "Befund-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_findings_validators",
        placeholder: "Befund-Validator auswählen",
        editorOnly: true,
      },
      {
        key: "classification_validators",
        label: "Klassifikations-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_classification_validators",
        placeholder: "Klassifikations-Validator auswählen",
        editorOnly: true,
      },
      {
        key: "intervention_validators",
        label: "Interventions-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_intervention_validators",
        placeholder: "Interventions-Validator auswählen",
        editorOnly: true,
      },
      {
        key: "unit_validators",
        label: "Einheiten-Validatoren",
        type: "reference-tags",
        sourceModule: "lx_unit_validators",
        placeholder: "Einheiten-Validator auswählen",
        editorOnly: true,
      },
    ],
  },
];

export const MODULE_MAP = Object.fromEntries(MODULE_DEFINITIONS.map((moduleDefinition) => [moduleDefinition.key, moduleDefinition]));

export function getModuleDefinition(moduleKey) {
  return MODULE_MAP[moduleKey];
}

export function getModuleKeys() {
  return MODULE_DEFINITIONS.map((moduleDefinition) => moduleDefinition.key);
}

export function collectDependencies(moduleKey, seen = new Set()) {
  if (seen.has(moduleKey) || !MODULE_MAP[moduleKey]) {
    return [];
  }

  seen.add(moduleKey);
  const dependencies = [moduleKey];
  MODULE_MAP[moduleKey].dependsOn.forEach((dependencyKey) => {
    collectDependencies(dependencyKey, seen).forEach((nestedDependencyKey) => {
      dependencies.push(nestedDependencyKey);
    });
  });
  return [...new Set(dependencies)];
}

export function collectDependents(moduleKey, seen = new Set()) {
  if (seen.has(moduleKey) || !MODULE_MAP[moduleKey]) {
    return [];
  }

  seen.add(moduleKey);
  const dependents = [moduleKey];
  MODULE_DEFINITIONS.filter((moduleDefinition) => moduleDefinition.dependsOn.includes(moduleKey)).forEach(
    (moduleDefinition) => {
      collectDependents(moduleDefinition.key, seen).forEach((nestedDependentKey) => {
        dependents.push(nestedDependentKey);
      });
    },
  );
  return [...new Set(dependents)];
}

export function normalizeSelectedModules(selectedModuleKeys = []) {
  const requestedKeys = new Set(
    selectedModuleKeys.filter((moduleKey) => MODULE_MAP[moduleKey] && !MODULE_MAP[moduleKey].hidden),
  );
  const withDependencies = new Set();

  requestedKeys.forEach((moduleKey) => {
    collectDependencies(moduleKey).forEach((dependencyKey) => withDependencies.add(dependencyKey));
  });

  return MODULE_DEFINITIONS.map((moduleDefinition) => moduleDefinition.key).filter((moduleKey) =>
    withDependencies.has(moduleKey),
  );
}
