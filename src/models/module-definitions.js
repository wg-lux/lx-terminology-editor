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
      { key: "findings", label: "Befunde", type: "tags", placeholder: "colon_polyp" },
      { key: "indications", label: "Indikationen", type: "tags", placeholder: "colonoscopy_screening" },
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
      { key: "classifications", label: "Klassifikationen", type: "tags", placeholder: "size_mm" },
      { key: "interventions", label: "Interventionen", type: "tags", placeholder: "endoscopy_hemoclip_generic" },
      {
        key: "caused_by_interventions",
        label: "Verursachende Interventionen",
        type: "tags",
        placeholder: "prior_polypectomy",
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
      { key: "classifications", label: "Klassifikationen", type: "tags", placeholder: "size_mm" },
      { key: "interventions", label: "Interventionen", type: "tags", placeholder: "endoscopy_hemoclip_generic" },
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
      { key: "classifications", label: "Klassifikationen", type: "tags", placeholder: "size_mm" },
      { key: "intervention_types", label: "Interventionstypen", type: "tags", placeholder: "therapeutic" },
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
        placeholder: "colon_lesion_paris_Is",
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
      { key: "unit", label: "Einheit", type: "text", placeholder: "minutes" },
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
        type: "text",
        placeholder: "uniform",
      },
      {
        key: "numeric_distribution_params",
        label: "Verteilungsparameter (JSON)",
        type: "json",
        placeholder: '{"low": 0, "high": 100}',
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
        label: "Standardoptionen (JSON)",
        type: "json",
        placeholder: '{"adenoma": 1}',
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
  const requestedKeys = new Set(selectedModuleKeys.filter((moduleKey) => MODULE_MAP[moduleKey]));
  const withDependencies = new Set();

  requestedKeys.forEach((moduleKey) => {
    collectDependencies(moduleKey).forEach((dependencyKey) => withDependencies.add(dependencyKey));
  });

  return MODULE_DEFINITIONS.map((moduleDefinition) => moduleDefinition.key).filter((moduleKey) =>
    withDependencies.has(moduleKey),
  );
}
