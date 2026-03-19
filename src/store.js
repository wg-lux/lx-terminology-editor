import { collectDependencies, collectDependents, getModuleDefinition, getModuleKeys } from "./models/module-definitions.js";
import { createDefaultDocument, createDefaultState, createEmptyRecord } from "./models/state-factory.js";
import { normalizeDocumentName, normalizeState, splitList } from "./models/validator.js";

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore(initialState = createDefaultState()) {
  let state = normalizeState(initialState);
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function mutate(mutator, options = {}) {
    const draft = cloneState(state);
    mutator(draft);
    state = normalizeState(draft);
    if (options.emit !== false) {
      emit();
    }
  }

  return {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    emit,

    replaceState(nextState) {
      state = normalizeState(nextState);
      emit();
    },

    reset() {
      state = createDefaultState();
      emit();
    },

    setBundleField(fieldKey, value, options = {}) {
      mutate((draft) => {
        draft.bundle[fieldKey] = value;
        if (fieldKey === "name" && (!draft.publish?.name || draft.publish.name === state.publish?.name)) {
          draft.publish = draft.publish || {};
          draft.publish.name = value;
        }
      }, options);
    },

    setPublishField(fieldKey, value, options = {}) {
      mutate((draft) => {
        draft.publish = draft.publish || {};
        draft.publish[fieldKey] = value;
      }, options);
    },

    toggleModule(moduleKey, isEnabled) {
      mutate((draft) => {
        const moduleKeys = new Set(draft.bundle.modules);
        if (isEnabled) {
          collectDependencies(moduleKey).forEach((dependencyKey) => moduleKeys.add(dependencyKey));
        } else {
          collectDependents(moduleKey).forEach((dependentKey) => moduleKeys.delete(dependentKey));
        }
        draft.bundle.modules = getModuleKeys().filter((key) => moduleKeys.has(key));
      });
    },

    addDocument(moduleKey, fileName) {
      mutate((draft) => {
        const normalizedName = normalizeDocumentName(fileName);
        if (!normalizedName) {
          return;
        }
        if (!Array.isArray(draft.documents[moduleKey])) {
          draft.documents[moduleKey] = [];
        }
        draft.documents[moduleKey].push(createDefaultDocument(moduleKey, normalizedName));
      });
    },

    renameDocument(moduleKey, documentId, fileName) {
      mutate((draft) => {
        const normalizedName = normalizeDocumentName(fileName);
        if (!normalizedName) {
          return;
        }
        const document = draft.documents[moduleKey]?.find((entry) => entry.id === documentId);
        if (document) {
          document.name = normalizedName;
        }
      });
    },

    removeDocument(moduleKey, documentId) {
      mutate((draft) => {
        const documents = draft.documents[moduleKey];
        if (!Array.isArray(documents) || documents.length <= 1) {
          return;
        }

        const removeIndex = documents.findIndex((entry) => entry.id === documentId);
        if (removeIndex === -1) {
          return;
        }

        const fallbackDocument = documents.find((entry) => entry.id !== documentId);
        if (!fallbackDocument) {
          return;
        }

        draft.records[moduleKey].forEach((record) => {
          if (record._documentId === documentId) {
            record._documentId = fallbackDocument.id;
          }
        });

        documents.splice(removeIndex, 1);
      });
    },

    addRecord(moduleKey, documentId) {
      mutate((draft) => {
        const record = createEmptyRecord(getModuleDefinition(moduleKey));
        record._documentId = documentId || draft.documents?.[moduleKey]?.[0]?.id || null;
        draft.records[moduleKey].push(record);
      });
    },

    duplicateRecord(moduleKey, recordIndex) {
      mutate((draft) => {
        const record = draft.records[moduleKey][recordIndex];
        if (!record) {
          return;
        }
        draft.records[moduleKey].splice(recordIndex + 1, 0, cloneState(record));
      });
    },

    removeRecord(moduleKey, recordIndex) {
      mutate((draft) => {
        draft.records[moduleKey].splice(recordIndex, 1);
      });
    },

    updateRecordField(moduleKey, recordIndex, fieldKey, value, options = {}) {
      mutate((draft) => {
        const moduleDefinition = getModuleDefinition(moduleKey);
        const fieldDefinition = moduleDefinition.fields.find((field) => field.key === fieldKey);
        if (!fieldDefinition || !draft.records[moduleKey][recordIndex]) {
          return;
        }

        if (fieldDefinition.type === "tags") {
          draft.records[moduleKey][recordIndex][fieldKey] = Array.isArray(value) ? value : splitList(value);
          return;
        }

        draft.records[moduleKey][recordIndex][fieldKey] = value;
      }, options);
    },
  };
}
