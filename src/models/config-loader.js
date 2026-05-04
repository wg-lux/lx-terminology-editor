import { MODULE_MAP } from "./module-definitions.js";
import { RECORD_PASSTHROUGH_KEY, pruneEmpty } from "./validator.js";

const REPORT_TEMPLATE_MODULE_KEY = "lx_report_templates";
const REPORT_SECTION_MODULE_KEY = "lx_report_template_sections";
const REPORT_TEMPLATE_VALIDATOR_FIELDS = [
  "examination_validators",
  "findings_validators",
  "classification_validators",
  "intervention_validators",
  "unit_validators",
];

function normalizeBundleIdentity(value, fallback) {
  return (
    String(value || "")
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/gi, "_")
      .replace(/^[_-]+|[_-]+$/g, "") || fallback
  );
}

function mergeUnique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function listValue(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function getGeneratedReportSectionName(reportTemplateRecord) {
  return `${normalizeBundleIdentity(reportTemplateRecord.name, "bericht")}_befunde`;
}

function buildGeneratedReportSections(state) {
  return (state.records?.[REPORT_TEMPLATE_MODULE_KEY] || [])
    .filter((record) => Array.isArray(record.report_findings) && record.report_findings.length && record.name)
    .map((record, index) => ({
      model: "report_template_section",
      name: getGeneratedReportSectionName(record),
      name_de: `${record.name_de || record.name} Befunde`,
      name_en: `${record.name_en || record.name} Findings`,
      description: "Automatisch aus den im Bericht ausgewählten Befunden erzeugt.",
      position: (index + 1) * 10,
      types: [],
      section_kind: "findings",
      findings: listValue(record.report_findings),
      fields: [],
    }));
}

function stripEditorOnlyFields(moduleDefinition, record) {
  const result = { ...record };
  moduleDefinition.fields
    .filter((fieldDefinition) => fieldDefinition.editorOnly)
    .forEach((fieldDefinition) => {
      delete result[fieldDefinition.key];
    });
  return result;
}

function buildReportTemplateValidators(record, passthrough) {
  const fallbackValidators =
    passthrough?.validators && typeof passthrough.validators === "object" && !Array.isArray(passthrough.validators)
      ? passthrough.validators
      : {};

  const validators = {};
  REPORT_TEMPLATE_VALIDATOR_FIELDS.forEach((fieldName) => {
    validators[fieldName] = mergeUnique([...listValue(fallbackValidators[fieldName]), ...listValue(record[fieldName])]);
  });

  return validators;
}

export function buildRootConfig(bundle) {
  return pruneEmpty({
    name: normalizeBundleIdentity(bundle.name, "terminologiepaket"),
    description: bundle.description,
    version: normalizeBundleIdentity(bundle.version, "0.1.0"),
    medical_field: normalizeBundleIdentity(bundle.medical_field, "gastroenterology"),
    author: bundle.author,
    modules: bundle.modules,
  });
}

export function buildModuleConfig(moduleDefinition) {
  return pruneEmpty({
    name: moduleDefinition.key,
    description: "",
    version: "0.1.0",
    modules: [],
    depends_on: moduleDefinition.dependsOn,
    data: {
      dirs: ["./data"],
    },
  });
}

export function buildFileObjects(state) {
  const fileObjects = {
    "config.yaml": buildRootConfig(state.bundle),
  };
  const generatedReportSections = buildGeneratedReportSections(state);
  const generatedReportSectionNames = new Set(generatedReportSections.map((section) => section.name));

  state.bundle.modules.forEach((moduleKey) => {
    const moduleDefinition = MODULE_MAP[moduleKey];
    fileObjects[`${moduleKey}/config.yaml`] = buildModuleConfig(moduleDefinition);
    const documents = state.documents?.[moduleKey]?.length
      ? state.documents[moduleKey]
      : [{ id: `${moduleKey}-fallback`, name: "custom.yaml" }];
    documents.forEach((document) => {
      fileObjects[`${moduleKey}/data/${document.name}`] = state.records[moduleKey]
        .filter((record) => record._documentId === document.id)
        .filter((record) => moduleKey !== REPORT_SECTION_MODULE_KEY || !generatedReportSectionNames.has(record.name))
        .map((record) => {
          const passthrough =
            record[RECORD_PASSTHROUGH_KEY] && typeof record[RECORD_PASSTHROUGH_KEY] === "object"
              ? record[RECORD_PASSTHROUGH_KEY]
              : {};
          const exportPassthrough = { ...passthrough };
          const exportRecord = stripEditorOnlyFields(moduleDefinition, record);

          if (moduleKey === REPORT_TEMPLATE_MODULE_KEY && Array.isArray(record.report_findings) && record.report_findings.length) {
            exportRecord.report_sections = mergeUnique([
              getGeneratedReportSectionName(record),
              ...listValue(exportRecord.report_sections),
            ]);
          }

          if (moduleKey === REPORT_TEMPLATE_MODULE_KEY) {
            delete exportPassthrough.validators;
            exportRecord.validators = buildReportTemplateValidators(record, passthrough);
          }

          return pruneEmpty({
            model: moduleDefinition.model,
            ...exportRecord,
            ...exportPassthrough,
            _documentId: undefined,
            [RECORD_PASSTHROUGH_KEY]: undefined,
          });
        });
    });
  });

  if (state.bundle.modules.includes(REPORT_SECTION_MODULE_KEY) && generatedReportSections.length) {
    fileObjects[`${REPORT_SECTION_MODULE_KEY}/data/generated.yaml`] = generatedReportSections;
  }

  return fileObjects;
}

export function buildPreviewGroups(state) {
  const groups = [
    {
      key: "root",
      label: "Basis",
      description: "Zentrale Paketkonfiguration",
      files: [
        {
          path: "config.yaml",
          label: "config.yaml",
          kind: "root-config",
        },
      ],
    },
  ];

  state.bundle.modules.forEach((moduleKey) => {
    const moduleDefinition = MODULE_MAP[moduleKey];
    const documents = state.documents?.[moduleKey]?.length
      ? state.documents[moduleKey]
      : [{ id: `${moduleKey}-fallback`, name: "custom.yaml" }];
    groups.push({
      key: moduleKey,
      label: moduleDefinition.label,
      description: moduleKey,
      files: [
        {
          path: `${moduleKey}/config.yaml`,
          label: "config.yaml",
          kind: "module-config",
        },
        ...documents.map((document) => ({
          path: `${moduleKey}/data/${document.name}`,
          label: document.name,
          kind: "module-data",
          emphasis: document.name === "custom.yaml" ? "low" : "high",
          documentId: document.id,
        })),
      ],
    });
  });

  return groups;
}

export function parseConfigYaml(sourceText) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  sourceText
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
    .forEach((rawLine) => {
      const trimmed = rawLine.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      const indent = rawLine.match(/^ */)[0].length;
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }

      const parent = stack[stack.length - 1].value;

      if (trimmed.startsWith("- ")) {
        if (!Array.isArray(parent)) {
          return;
        }
        parent.push(parseScalar(trimmed.slice(2)));
        return;
      }

      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex === -1) {
        return;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (rawValue) {
        parent[key] = parseScalar(rawValue);
        return;
      }

      const nextValue = key === "modules" || key === "depends_on" || key === "dirs" ? [] : {};
      parent[key] = nextValue;
      stack.push({ indent, value: nextValue });
    });

  return root;
}

export function loadBundleFromConfig(configInput) {
  const configObject = typeof configInput === "string" ? parseConfigYaml(configInput) : configInput;
  return pruneEmpty({
    name: configObject?.name || "",
    description: configObject?.description || "",
    version: configObject?.version || "",
    modules: Array.isArray(configObject?.modules) ? configObject.modules : [],
  });
}

function parseScalar(rawValue) {
  if (rawValue === '""' || rawValue === "''") {
    return "";
  }

  if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
    return rawValue.slice(1, -1);
  }

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  if (!Number.isNaN(Number(rawValue)) && rawValue !== "") {
    return Number(rawValue);
  }

  return rawValue;
}
