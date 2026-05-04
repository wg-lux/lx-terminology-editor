import { MODULE_DEFINITIONS, MODULE_MAP } from "../models/module-definitions.js";
import { normalizeState } from "../models/validator.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeComparableValue(value) {
  if (Array.isArray(value)) {
    const normalizedItems = value.map((item) => normalizeComparableValue(item));
    if (normalizedItems.every((item) => item === null || ["boolean", "number", "string"].includes(typeof item))) {
      return [...normalizedItems].sort();
    }
    return normalizedItems;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeComparableValue(value[key])]),
    );
  }

  return value ?? null;
}

function comparableRecord(record) {
  const { _documentId, ...content } = record;
  return normalizeComparableValue(content);
}

function stableStringify(value) {
  return JSON.stringify(normalizeComparableValue(value));
}

function recordIdentity(record) {
  const name = typeof record.name === "string" ? record.name.trim() : "";
  return name || null;
}

function buildUniqueRecordIndex(records) {
  const buckets = new Map();
  records.forEach((record, index) => {
    const identity = recordIdentity(record);
    if (!identity) {
      return;
    }
    if (!buckets.has(identity)) {
      buckets.set(identity, []);
    }
    buckets.get(identity).push(index);
  });

  const unique = new Map();
  buckets.forEach((indexes, identity) => {
    if (indexes.length === 1) {
      unique.set(identity, indexes[0]);
    }
  });
  return unique;
}

function getDocumentName(state, moduleKey, documentId) {
  const document = state.documents[moduleKey]?.find((entry) => entry.id === documentId);
  return document?.name || "custom.yaml";
}

function fieldLabel(moduleKey, key) {
  const fieldDefinition = MODULE_MAP[moduleKey]?.fields.find((field) => field.key === key);
  return fieldDefinition?.label || key;
}

function collectFieldDifferences(moduleKey, currentRecord, incomingRecord) {
  const keys = new Set([...Object.keys(currentRecord), ...Object.keys(incomingRecord)]);
  keys.delete("_documentId");

  return [...keys]
    .sort()
    .filter((key) => stableStringify(currentRecord[key]) !== stableStringify(incomingRecord[key]))
    .map((key) => ({
      key,
      label: fieldLabel(moduleKey, key),
      currentValue: currentRecord[key],
      incomingValue: incomingRecord[key],
    }));
}

function ensureModuleState(state, moduleKey) {
  if (!Array.isArray(state.documents[moduleKey])) {
    state.documents[moduleKey] = [];
  }
  if (!state.documents[moduleKey].length) {
    state.documents[moduleKey].push({ id: `${moduleKey}-merged-1`, name: "custom.yaml" });
  }
  if (!Array.isArray(state.records[moduleKey])) {
    state.records[moduleKey] = [];
  }
}

function findOrCreateDocument(state, moduleKey, documentName) {
  ensureModuleState(state, moduleKey);
  const targetName = documentName || "custom.yaml";
  const existing = state.documents[moduleKey].find((document) => document.name === targetName);
  if (existing) {
    return existing.id;
  }

  const document = {
    id: `${moduleKey}-merged-${state.documents[moduleKey].length + 1}`,
    name: targetName,
  };
  state.documents[moduleKey].push(document);
  return document.id;
}

export function createMergePlan(currentCandidate, incomingCandidate) {
  const currentState = normalizeState(currentCandidate);
  const incomingState = normalizeState(incomingCandidate);
  const additions = [];
  const conflicts = [];
  const unchanged = [];
  const modulesAdded = incomingState.bundle.modules.filter((moduleKey) => !currentState.bundle.modules.includes(moduleKey));

  MODULE_DEFINITIONS.forEach((moduleDefinition) => {
    const moduleKey = moduleDefinition.key;
    const currentRecords = currentState.records[moduleKey] || [];
    const incomingRecords = incomingState.records[moduleKey] || [];
    const currentIndex = buildUniqueRecordIndex(currentRecords);

    incomingRecords.forEach((incomingRecord, incomingIndex) => {
      const identity = recordIdentity(incomingRecord);
      const documentName = getDocumentName(incomingState, moduleKey, incomingRecord._documentId);

      if (!identity || !currentIndex.has(identity)) {
        additions.push({
          id: `${moduleKey}:add:${incomingIndex}`,
          moduleKey,
          recordName: identity || `Eintrag ${incomingIndex + 1}`,
          incomingIndex,
          documentName,
        });
        return;
      }

      const currentRecordIndex = currentIndex.get(identity);
      const currentRecord = currentRecords[currentRecordIndex];
      if (stableStringify(comparableRecord(currentRecord)) === stableStringify(comparableRecord(incomingRecord))) {
        unchanged.push({ moduleKey, recordName: identity });
        return;
      }

      conflicts.push({
        id: `${moduleKey}:conflict:${identity}`,
        moduleKey,
        recordName: identity,
        currentIndex: currentRecordIndex,
        incomingIndex,
        documentName,
        differences: collectFieldDifferences(moduleKey, currentRecord, incomingRecord),
      });
    });
  });

  return {
    currentState,
    incomingState,
    additions,
    conflicts,
    unchanged,
    modulesAdded,
    summary: {
      additions: additions.length,
      conflicts: conflicts.length,
      unchanged: unchanged.length,
      modulesAdded: modulesAdded.length,
    },
  };
}

export function applyMergePlan(plan, choices = {}) {
  const mergedState = clone(plan.currentState);
  const selectedModules = new Set([...mergedState.bundle.modules, ...plan.incomingState.bundle.modules]);
  mergedState.bundle.modules = MODULE_DEFINITIONS.map((moduleDefinition) => moduleDefinition.key).filter((moduleKey) =>
    selectedModules.has(moduleKey),
  );

  MODULE_DEFINITIONS.forEach((moduleDefinition) => {
    ensureModuleState(mergedState, moduleDefinition.key);
  });

  plan.additions.forEach((addition) => {
    const incomingRecord = clone(plan.incomingState.records[addition.moduleKey][addition.incomingIndex]);
    incomingRecord._documentId = findOrCreateDocument(mergedState, addition.moduleKey, addition.documentName);
    mergedState.records[addition.moduleKey].push(incomingRecord);
  });

  plan.conflicts.forEach((conflict) => {
    if (choices[conflict.id] !== "incoming") {
      return;
    }

    const incomingRecord = clone(plan.incomingState.records[conflict.moduleKey][conflict.incomingIndex]);
    const currentRecord = mergedState.records[conflict.moduleKey][conflict.currentIndex];
    incomingRecord._documentId = currentRecord?._documentId || findOrCreateDocument(mergedState, conflict.moduleKey, conflict.documentName);
    mergedState.records[conflict.moduleKey][conflict.currentIndex] = incomingRecord;
  });

  return normalizeState(mergedState);
}

export function formatMergeValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "leer";
  }
  if (value === undefined || value === null || value === "") {
    return "leer";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
