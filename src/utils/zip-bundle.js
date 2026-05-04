import { parse } from "../vendor/yaml/index.js";
import { MODULE_MAP } from "../models/module-definitions.js";
import { normalizeDocumentName } from "../models/validator.js";

const REPORT_TEMPLATE_VALIDATOR_FIELDS = [
  "examination_validators",
  "findings_validators",
  "classification_validators",
  "intervention_validators",
  "unit_validators",
];

function getZipRuntime() {
  const zipRuntime = globalThis.JSZip;
  if (!zipRuntime) {
    throw new Error("JSZip ist nicht geladen.");
  }
  return zipRuntime;
}

function createDocumentId(moduleKey, index) {
  return `${moduleKey}-import-${index + 1}`;
}

function normalizeIdentity(value, fallback) {
  return (
    String(value || "")
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/gi, "_")
      .replace(/^[_-]+|[_-]+$/g, "") || fallback
  );
}

function listValue(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function getGeneratedReportSectionName(reportTemplate) {
  return `${normalizeIdentity(reportTemplate?.name, "bericht")}_befunde`;
}

function findingNameFromReportSectionEntry(entry) {
  if (typeof entry === "string") {
    return entry;
  }
  if (entry && typeof entry === "object" && typeof entry.finding === "string") {
    return entry.finding;
  }
  return "";
}

function hydrateReportTemplateFindings(state) {
  const reportTemplates = state.records.lx_report_templates || [];
  const reportSections = state.records.lx_report_template_sections || [];
  if (!reportTemplates.length || !reportSections.length) {
    return;
  }

  const sectionsByName = new Map(reportSections.map((section) => [section.name, section]));
  reportTemplates.forEach((template) => {
    const generatedSectionName = getGeneratedReportSectionName(template);
    const sectionNames = listValue(template.report_sections).filter((sectionName) => sectionName === generatedSectionName);
    const reportFindings = sectionNames.flatMap((sectionName) =>
      listValue(sectionsByName.get(sectionName)?.findings)
        .map(findingNameFromReportSectionEntry)
        .filter(Boolean),
    );
    if (reportFindings.length) {
      template.report_findings = [...new Set([...(template.report_findings || []), ...reportFindings])];
    }
  });
}

function expandReportTemplateEditorFields(moduleKey, record) {
  if (moduleKey !== "lx_report_templates") {
    return record;
  }

  const validators =
    record.validators && typeof record.validators === "object" && !Array.isArray(record.validators) ? record.validators : null;
  if (!validators) {
    return record;
  }

  const expandedRecord = { ...record };
  REPORT_TEMPLATE_VALIDATOR_FIELDS.forEach((fieldName) => {
    expandedRecord[fieldName] = listValue(validators[fieldName]);
  });
  delete expandedRecord.validators;
  return expandedRecord;
}

export async function downloadBundleZip(entries, filename = "terminologiepaket.zip") {
  const JSZip = getZipRuntime();
  const zip = new JSZip();
  const rootFolderName = filename.replace(/\.zip$/i, "") || "terminologiepaket";
  Object.entries(entries).forEach(([path, content]) => {
    zip.file(`${rootFolderName}/${path}`, content);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importBundleZip(file) {
  if (!file) {
    throw new Error("Keine ZIP-Datei ausgewählt.");
  }

  const JSZip = getZipRuntime();
  const zip = await JSZip.loadAsync(file);
  const fileMap = {};

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) {
        return;
      }
      fileMap[entry.name] = await entry.async("string");
    }),
  );

  const normalizedFileMap = normalizeZipRoot(fileMap);

  if (!normalizedFileMap["config.yaml"]) {
    throw new Error("Die ZIP-Datei enthält keine Basis-config.yaml.");
  }

  const rootConfig = parseYamlFile(normalizedFileMap["config.yaml"], "config.yaml");
  const moduleKeys = Array.isArray(rootConfig?.modules)
    ? rootConfig.modules.filter((moduleKey) => MODULE_MAP[moduleKey])
    : [];

  const state = {
    bundle: {
      name: typeof rootConfig?.name === "string" ? rootConfig.name : "",
      description: typeof rootConfig?.description === "string" ? rootConfig.description : "",
      version: typeof rootConfig?.version === "string" ? rootConfig.version : "",
      author:
        typeof rootConfig?.author === "string"
          ? rootConfig.author
          : Array.isArray(rootConfig?.authors)
            ? rootConfig.authors.filter((author) => typeof author === "string" && author.trim()).join(", ")
            : "",
      medical_field: typeof rootConfig?.medical_field === "string" ? rootConfig.medical_field : "",
      modules: moduleKeys,
    },
    documents: {},
    records: {},
  };

  Object.keys(MODULE_MAP).forEach((moduleKey) => {
    state.documents[moduleKey] = [];
    state.records[moduleKey] = [];
  });

  moduleKeys.forEach((moduleKey) => {
    const moduleDefinition = MODULE_MAP[moduleKey];
    const dataPrefix = `${moduleKey}/data/`;
    const dataPaths = Object.keys(normalizedFileMap)
      .filter((path) => path.startsWith(dataPrefix) && path.endsWith(".yaml"))
      .sort();

    if (!dataPaths.length) {
      const fallbackId = createDocumentId(moduleKey, 0);
      state.documents[moduleKey].push({ id: fallbackId, name: "custom.yaml" });
      return;
    }

    dataPaths.forEach((path, index) => {
      const fileName = path.slice(dataPrefix.length);
      const normalizedName = normalizeDocumentName(fileName) || `document-${index + 1}.yaml`;
      const documentId = createDocumentId(moduleKey, index);
      state.documents[moduleKey].push({ id: documentId, name: normalizedName });

      const parsedEntries = parseYamlFile(normalizedFileMap[path], path);
      if (!Array.isArray(parsedEntries)) {
        throw new Error(`${path} muss eine YAML-Liste sein.`);
      }

      parsedEntries.forEach((entry, recordIndex) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          throw new Error(`${path} enthält einen ungültigen Eintrag an Position ${recordIndex + 1}.`);
        }

        const { model, _documentId, ...record } = entry;
        if (typeof model === "string" && model !== moduleDefinition.model) {
          throw new Error(`${path} enthält Modell '${model}', erwartet '${moduleDefinition.model}'.`);
        }

        state.records[moduleKey].push({
          ...expandReportTemplateEditorFields(moduleKey, record),
          _documentId: documentId,
        });
      });
    });
  });

  hydrateReportTemplateFindings(state);

  return state;
}

function parseYamlFile(source, path) {
  try {
    return parse(source);
  } catch (error) {
    throw new Error(`Konnte ${path} nicht lesen. Bitte die YAML-Syntax prüfen.`);
  }
}

function normalizeZipRoot(fileMap) {
  if (fileMap["config.yaml"]) {
    return fileMap;
  }

  const paths = Object.keys(fileMap);
  if (!paths.length) {
    return fileMap;
  }

  const rootSegment = paths[0].split("/")[0];
  if (!rootSegment || !paths.every((path) => path.startsWith(`${rootSegment}/`))) {
    return fileMap;
  }

  const normalizedEntries = Object.fromEntries(
    Object.entries(fileMap).map(([path, content]) => [path.slice(rootSegment.length + 1), content]),
  );

  return normalizedEntries["config.yaml"] ? normalizedEntries : fileMap;
}
