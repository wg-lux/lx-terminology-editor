import { MODULE_DEFINITIONS, MODULE_MAP, normalizeSelectedModules } from "./module-definitions.js";
import { createDefaultDocument, createDefaultState, createEmptyRecord } from "./state-factory.js";

export const RECORD_PASSTHROUGH_KEY = "_passthrough";

export function pruneEmpty(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneEmpty(item))
      .filter((item) => item !== undefined && item !== null && !(Array.isArray(item) && item.length === 0));
  }

  if (value && typeof value === "object") {
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      const cleaned = pruneEmpty(entry);
      if (cleaned === undefined || cleaned === null || cleaned === "") {
        return;
      }
      if (Array.isArray(cleaned) && !cleaned.length) {
        return;
      }
      if (typeof cleaned === "object" && !Array.isArray(cleaned) && !Object.keys(cleaned).length) {
        return;
      }
      result[key] = cleaned;
    });
    return result;
  }

  return value;
}

export function splitList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeBundle(candidateBundle = {}) {
  const fallbackBundle = createDefaultState().bundle;
  return {
    name: typeof candidateBundle.name === "string" ? candidateBundle.name : fallbackBundle.name,
    description:
      typeof candidateBundle.description === "string" ? candidateBundle.description : fallbackBundle.description,
    version: typeof candidateBundle.version === "string" ? candidateBundle.version : fallbackBundle.version,
    modules: normalizeSelectedModules(
      Array.isArray(candidateBundle.modules) ? candidateBundle.modules : fallbackBundle.modules,
    ),
  };
}

export function normalizeRecord(moduleDefinition, candidateRecord = {}) {
  const record = createEmptyRecord(moduleDefinition);
  const knownFieldKeys = new Set(moduleDefinition.fields.map((fieldDefinition) => fieldDefinition.key));

  moduleDefinition.fields.forEach((fieldDefinition) => {
    const value = candidateRecord[fieldDefinition.key];
    if (fieldDefinition.type === "tags") {
      record[fieldDefinition.key] = Array.isArray(value) ? value.filter(Boolean) : splitList(value);
      return;
    }

    if (fieldDefinition.type === "select") {
      record[fieldDefinition.key] = fieldDefinition.options.includes(value) ? value : fieldDefinition.options[0];
      return;
    }

    record[fieldDefinition.key] = typeof value === "string" ? value : "";
  });

  const passthrough = {};
  Object.entries(candidateRecord).forEach(([key, value]) => {
    if (knownFieldKeys.has(key) || key === "model" || key === "_documentId" || key === RECORD_PASSTHROUGH_KEY) {
      return;
    }
    passthrough[key] = value;
  });

  if (candidateRecord[RECORD_PASSTHROUGH_KEY] && typeof candidateRecord[RECORD_PASSTHROUGH_KEY] === "object") {
    Object.assign(passthrough, candidateRecord[RECORD_PASSTHROUGH_KEY]);
  }

  if (Object.keys(passthrough).length) {
    record[RECORD_PASSTHROUGH_KEY] = passthrough;
  }

  return record;
}

export function normalizeDocumentName(value) {
  const baseName = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!baseName) {
    return "";
  }

  return baseName.endsWith(".yaml") ? baseName : `${baseName}.yaml`;
}

export function normalizeDocument(moduleKey, candidateDocument = {}, fallbackIndex = 0) {
  const defaultDocument = createDefaultDocument(moduleKey);
  const normalizedName = normalizeDocumentName(candidateDocument.name || defaultDocument.name) || `document-${fallbackIndex + 1}.yaml`;
  return {
    id: typeof candidateDocument.id === "string" ? candidateDocument.id : defaultDocument.id,
    name: normalizedName,
  };
}

export function normalizeState(candidateState = {}) {
  const fallbackState = createDefaultState();
  const normalizedState = {
    bundle: normalizeBundle(candidateState.bundle),
    documents: {},
    records: {},
  };

  MODULE_DEFINITIONS.forEach((moduleDefinition) => {
    const candidateDocuments = candidateState.documents?.[moduleDefinition.key];
    normalizedState.documents[moduleDefinition.key] = Array.isArray(candidateDocuments) && candidateDocuments.length
      ? candidateDocuments.map((document, index) => normalizeDocument(moduleDefinition.key, document, index))
      : fallbackState.documents[moduleDefinition.key];

    const validDocumentIds = new Set(normalizedState.documents[moduleDefinition.key].map((document) => document.id));
    const defaultDocumentId = normalizedState.documents[moduleDefinition.key][0].id;
    const candidateRecords = candidateState.records?.[moduleDefinition.key];
    normalizedState.records[moduleDefinition.key] = Array.isArray(candidateRecords)
      ? candidateRecords.map((record) => {
          const normalizedRecord = normalizeRecord(moduleDefinition, record);
          normalizedRecord._documentId =
            typeof record?._documentId === "string" && validDocumentIds.has(record._documentId)
              ? record._documentId
              : defaultDocumentId;
          return normalizedRecord;
        })
      : fallbackState.records[moduleDefinition.key];
  });

  return normalizedState;
}

export function validateRecord(moduleDefinition, record) {
  const errors = [];

  moduleDefinition.fields.forEach((fieldDefinition) => {
    const value = record[fieldDefinition.key];

    if (fieldDefinition.required) {
      const isEmptyArray = fieldDefinition.type === "tags" && (!Array.isArray(value) || !value.length);
      const isEmptyString = fieldDefinition.type !== "tags" && !String(value || "").trim();
      if (isEmptyArray || isEmptyString) {
        errors.push(`${fieldDefinition.label} ist erforderlich.`);
      }
    }

    if (fieldDefinition.type === "select" && value && !fieldDefinition.options.includes(value)) {
      errors.push(`${fieldDefinition.label} muss einer der folgenden Werte sein: ${fieldDefinition.options.join(", ")}.`);
    }
  });

  return errors;
}

export function validateBundle(state) {
  const normalizedState = normalizeState(state);
  const bundleErrors = [];
  const moduleErrors = {};
  let totalErrors = 0;

  if (!normalizedState.bundle.name.trim()) {
    bundleErrors.push("Bundle-Name ist erforderlich.");
  }

  if (!normalizedState.bundle.version.trim()) {
    bundleErrors.push("Bundle-Version ist erforderlich.");
  }

  normalizedState.bundle.modules.forEach((moduleKey) => {
    const moduleDefinition = MODULE_MAP[moduleKey];
    moduleErrors[moduleKey] = normalizedState.records[moduleKey].map((record) => validateRecord(moduleDefinition, record));
    totalErrors += moduleErrors[moduleKey].reduce((sum, recordErrors) => sum + recordErrors.length, 0);
  });

  totalErrors += bundleErrors.length;

  return {
    bundleErrors,
    moduleErrors,
    totalErrors,
  };
}
