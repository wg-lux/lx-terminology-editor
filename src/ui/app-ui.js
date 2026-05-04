import { buildFileObjects, buildPreviewGroups } from "../models/config-loader.js";
import { MODULE_MAP } from "../models/module-definitions.js";
import { validateBundle } from "../models/validator.js";
import { downloadTextEntries } from "../utils/download.js";
import { applyMergePlan, createMergePlan, formatMergeValue } from "../utils/merge-bundle.js";
import { runPyodideLint } from "../utils/pyodide-lint.js";
import { downloadBundleZip, importBundleZip } from "../utils/zip-bundle.js";
import { buildShareUrl } from "../utils/url-hash.js";
import { stringifyYaml } from "../utils/yaml-helper.js";

const FIELD_OPTION_LABELS = {
  anesthesiology: "Anästhesiologie",
  boolean: "Ja/Nein",
  cardiology: "Kardiologie",
  condition: "Bedingung",
  dermatology: "Dermatologie",
  emergency_medicine: "Notfallmedizin",
  endocrinology: "Endokrinologie",
  exists: "muss vorhanden sein",
  findings: "Befunde",
  general_medicine: "Allgemeinmedizin",
  gastroenterology: "Gastroenterologie",
  gynecology: "Gynäkologie",
  hematology: "Hämatologie",
  history: "Anamnese",
  intensive_care: "Intensivmedizin",
  internal_medicine: "Innere Medizin",
  laboratory_medicine: "Labormedizin",
  missing: "muss fehlen",
  nephrology: "Nephrologie",
  neurology: "Neurologie",
  oncology: "Onkologie",
  optional: "optional",
  orthopedics: "Orthopädie",
  otolaryngology: "Hals-Nasen-Ohren-Heilkunde",
  pathology: "Pathologie",
  patient_data: "Patientendaten",
  pediatrics: "Pädiatrie",
  psychiatry: "Psychiatrie",
  pulmonology: "Pneumologie",
  radiology: "Radiologie",
  required: "erforderlich",
  rheumatology: "Rheumatologie",
  surgery: "Chirurgie",
  numeric: "Zahl",
  selection: "Auswahl",
  text: "Text",
  urology: "Urologie",
};

const MEDICAL_FIELD_OPTIONS = [
  "gastroenterology",
  "general_medicine",
  "internal_medicine",
  "cardiology",
  "pulmonology",
  "neurology",
  "oncology",
  "radiology",
  "surgery",
  "anesthesiology",
  "intensive_care",
  "emergency_medicine",
  "pediatrics",
  "gynecology",
  "urology",
  "dermatology",
  "orthopedics",
  "otolaryngology",
  "psychiatry",
  "pathology",
  "laboratory_medicine",
  "endocrinology",
  "nephrology",
  "hematology",
  "rheumatology",
];

function optionLabel(value) {
  return FIELD_OPTION_LABELS[value] || value;
}

export function mountApp({ store }) {
  const bundleForm = document.querySelector("#bundle-form");
  const modulePickers = document.querySelector("#module-pickers");
  const moduleTabs = document.querySelector("#module-tabs");
  const moduleEditor = document.querySelector("#module-editor");
  const fileTabs = document.querySelector("#file-tabs");
  const filePreview = document.querySelector("#file-preview");
  const shareButton = document.querySelector("#share-button");
  const downloadButton = document.querySelector("#download-button");
  const zipDownloadButton = document.querySelector("#zip-download-button");
  const zipOpenButton = document.querySelector("#zip-open-button");
  const zipMergeButton = document.querySelector("#zip-merge-button");
  const zipImportInput = document.querySelector("#zip-import-input");
  const mergePanel = document.querySelector("#merge-panel");
  const lintButtons = document.querySelectorAll('[data-action="lint"]');
  const resetButton = document.querySelector("#reset-button");
  const cardTemplate = document.querySelector("#record-card-template");
  const lintStatus = document.querySelector("#lint-status");
  const lintOutput = document.querySelector("#lint-output");

  let activeModuleKey = store.getState().bundle.modules[0] || "lx_examinations";
  let activePreviewGroupKey = "root";
  let activeFilePath = "config.yaml";
  const activeDocumentIds = {};
  let lintState = {
    status: "idle",
    summary: "Noch nicht geprüft.",
    output: "Noch keine Prüfausgabe.",
  };
  let zipImportMode = "open";
  let pendingMergePlan = null;
  let mergeChoices = {};

  function visibleModuleKeys(state) {
    return state.bundle.modules.filter((moduleKey) => !MODULE_MAP[moduleKey]?.hidden);
  }

  shareButton.addEventListener("click", async () => {
    const shareUrl = buildShareUrl(store.getState());
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Freigabelink in die Zwischenablage kopiert.");
        return;
      }
    } catch (error) {
      console.error(error);
    }
    window.prompt("Diesen Freigabelink kopieren:", shareUrl);
  });

  downloadButton.addEventListener("click", () => {
    downloadTextEntries(buildSerializedFiles(store.getState()));
    showToast("YAML-Dateien heruntergeladen.");
  });

  zipDownloadButton.addEventListener("click", async () => {
    try {
      const state = store.getState();
      const bundleName = (state.bundle.name || "terminologiepaket").trim() || "terminologiepaket";
      await downloadBundleZip(buildSerializedFiles(state), `${bundleName}.zip`);
      showToast("ZIP-Datei heruntergeladen.");
    } catch (error) {
      console.error(error);
      showToast("ZIP-Download fehlgeschlagen.");
    }
  });

  zipOpenButton.addEventListener("click", () => {
    zipImportMode = "open";
    zipImportInput.value = "";
    zipImportInput.click();
  });

  zipMergeButton.addEventListener("click", () => {
    zipImportMode = "merge";
    zipImportInput.value = "";
    zipImportInput.click();
  });

  zipImportInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      const importedState = await importBundleZip(file);
      if (zipImportMode === "merge") {
        startMerge(importedState);
      } else {
        openImportedState(importedState);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "ZIP-Import fehlgeschlagen.");
    }
  });

  lintButtons.forEach((lintButton) => {
    lintButton.addEventListener("click", async () => {
      lintState = {
        status: "running",
        summary: "Prüfung wird vorbereitet...",
        output: "Lade Python-Prüfumgebung im Browser. Das kann beim ersten Mal kurz dauern.",
      };
      render(store.getState());

      try {
        const result = await runPyodideLint(buildSerializedFiles(store.getState()));
        lintState = {
          status: result.ok ? "ok" : "error",
          summary: result.summary_text || "Prüfung abgeschlossen.",
          output: result.output || "Keine Ausgabe.",
        };
        showToast(result.ok ? "Prüfung erfolgreich." : "Prüfung mit Hinweisen beendet.");
      } catch (error) {
        lintState = {
          status: "error",
          summary: "Prüfung fehlgeschlagen.",
          output:
            error.message ||
            "Die Python-Prüfumgebung konnte nicht gestartet werden. Prüfe die Internetverbindung und lade die Seite neu.",
        };
        console.error(error);
        showToast("Prüfung fehlgeschlagen.");
      }

      render(store.getState());
    });
  });

  resetButton.addEventListener("click", () => {
    pendingMergePlan = null;
    mergeChoices = {};
    store.reset();
    focusFirstModule();
    render(store.getState());
    showToast("Beispielpaket wiederhergestellt.");
  });

  store.subscribe(render);
  render(store.getState());

  function openImportedState(importedState) {
    const confirmed = window.confirm("Dieses ZIP öffnet ein neues Paket und ersetzt den aktuellen Arbeitsstand.");
    if (!confirmed) {
      return;
    }
    pendingMergePlan = null;
    mergeChoices = {};
    store.replaceState(importedState);
    focusFirstModule();
    render(store.getState());
    showToast("ZIP-Paket geöffnet.");
  }

  function startMerge(importedState) {
    const plan = createMergePlan(store.getState(), importedState);
    if (!plan.additions.length && !plan.conflicts.length && !plan.modulesAdded.length) {
      pendingMergePlan = null;
      mergeChoices = {};
      renderMergePanel();
      showToast("Keine Unterschiede gefunden.");
      return;
    }

    if (!plan.conflicts.length) {
      pendingMergePlan = null;
      mergeChoices = {};
      store.replaceState(applyMergePlan(plan, {}));
      focusFirstModule();
      render(store.getState());
      showToast(buildMergeSummary(plan, 0));
      return;
    }

    pendingMergePlan = plan;
    mergeChoices = Object.fromEntries(plan.conflicts.map((conflict) => [conflict.id, "current"]));
    renderMergePanel();
    mergePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("Bitte Unterschiede prüfen.");
  }

  function applyPendingMerge() {
    if (!pendingMergePlan) {
      return;
    }
    const mergedState = applyMergePlan(pendingMergePlan, mergeChoices);
    const appliedIncoming = pendingMergePlan.conflicts.filter((conflict) => mergeChoices[conflict.id] === "incoming").length;
    const summaryText = buildMergeSummary(pendingMergePlan, appliedIncoming);
    pendingMergePlan = null;
    mergeChoices = {};
    store.replaceState(mergedState);
    focusFirstModule();
    render(store.getState());
    showToast(summaryText);
  }

  function cancelPendingMerge() {
    pendingMergePlan = null;
    mergeChoices = {};
    renderMergePanel();
    showToast("Zusammenführung abgebrochen.");
  }

  function focusFirstModule() {
    const nextState = store.getState();
    activeModuleKey = visibleModuleKeys(nextState)[0] || "lx_examinations";
    activePreviewGroupKey = "root";
    activeFilePath = "config.yaml";
  }

  function buildMergeSummary(plan, importedConflictCount) {
    const parts = [];
    if (plan.additions.length) {
      parts.push(`${plan.additions.length} neue Einträge`);
    }
    if (importedConflictCount) {
      parts.push(`${importedConflictCount} importierte Versionen`);
    }
    if (plan.modulesAdded.length) {
      parts.push(`${plan.modulesAdded.length} neue Module`);
    }
    return parts.length ? `${parts.join(", ")} übernommen.` : "Zusammenführung abgeschlossen.";
  }

  function refreshDerivedViews() {
    const state = store.getState();
    renderPreview(state);
    renderLintPanel();
  }

  function render(state) {
    try {
      const validation = validateBundle(state);
      const previewGroups = buildPreviewGroups(state);

      if (!state.bundle.modules.includes(activeModuleKey) || MODULE_MAP[activeModuleKey]?.hidden) {
        activeModuleKey = visibleModuleKeys(state)[0] || "lx_examinations";
      }

      if (!previewGroups.some((group) => group.key === activePreviewGroupKey)) {
        activePreviewGroupKey = previewGroups[0]?.key || "root";
      }

      renderBundleForm(state, validation);
      renderModulePickers(state);
      renderModuleTabs(state, validation);
      renderModuleEditor(state, validation);
      renderPreview(state, previewGroups);
      renderLintPanel();
      renderMergePanel();
    } catch (error) {
      console.error("UI konnte nicht gerendert werden", error);
      moduleEditor.innerHTML = "";
      fileTabs.innerHTML = "";
      filePreview.textContent = `UI-Fehler: ${error?.message || error}`;

      const errorBox = document.createElement("div");
      errorBox.className = "field field-full";
      const title = document.createElement("label");
      title.textContent = "UI-Fehler";
      const message = document.createElement("p");
      message.className = "field-hint";
      message.textContent = `${error?.message || error}`;
      errorBox.append(title, message);
      moduleEditor.append(errorBox);
    }
  }

  function renderBundleForm(state, validation) {
    const fields = [
      { key: "name", label: "Paketname", type: "text", hint: "Wird in das Feld `name` der Basis-config.yaml geschrieben." },
      { key: "version", label: "Version", type: "text", hint: "Semantische Version empfohlen." },
      { key: "author", label: "Autor", type: "text", hint: "Name der verantwortlichen Person oder Arbeitsgruppe." },
      {
        key: "medical_field",
        label: "Fachbereich",
        type: "select",
        hint: "Wird als medizinischer Fachbereich in der Basis-config.yaml gespeichert.",
        options: MEDICAL_FIELD_OPTIONS,
      },
      { key: "description", label: "Beschreibung", type: "textarea", hint: "Optionale Paketbeschreibung.", full: true },
    ];

    bundleForm.innerHTML = "";

    fields.forEach((fieldDefinition) => {
      const wrapper = document.createElement("div");
      wrapper.className = `field${fieldDefinition.full ? " field-full" : ""}`;

      const label = document.createElement("label");
      label.textContent = fieldDefinition.label;

      let input;
      if (fieldDefinition.type === "textarea") {
        input = document.createElement("textarea");
      } else if (fieldDefinition.type === "select") {
        input = document.createElement("select");
        const currentValue = state.bundle[fieldDefinition.key] || "";
        const optionValues = [...fieldDefinition.options];
        if (currentValue && !optionValues.includes(currentValue)) {
          optionValues.unshift(currentValue);
        }
        optionValues.forEach((optionValue) => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = optionLabel(optionValue);
          input.append(option);
        });
      } else {
        input = document.createElement("input");
        input.type = fieldDefinition.type;
      }
      input.value = state.bundle[fieldDefinition.key] || "";
      input.addEventListener(fieldDefinition.type === "select" ? "change" : "input", (event) => {
        store.setBundleField(fieldDefinition.key, event.target.value, { emit: false });
        refreshDerivedViews();
      });

      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent = validation.bundleFieldErrors?.[fieldDefinition.key]?.join(" ") || fieldDefinition.hint;

      wrapper.append(label, input, hint);
      bundleForm.append(wrapper);
    });
  }

  function renderModulePickers(state) {
    modulePickers.innerHTML = "";

    Object.values(MODULE_MAP)
      .filter((moduleDefinition) => !moduleDefinition.hidden)
      .forEach((moduleDefinition) => {
        const card = document.createElement("div");
        card.className = "picker-card";

        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.bundle.modules.includes(moduleDefinition.key);
        checkbox.addEventListener("change", () => {
          store.toggleModule(moduleDefinition.key, checkbox.checked);
        });

        label.append(checkbox, document.createTextNode(moduleDefinition.label));

        const description = document.createElement("p");
        description.textContent = moduleDefinition.description;

        card.append(label, description);
        modulePickers.append(card);
      });
  }

  function renderModuleTabs(state, validation) {
    moduleTabs.innerHTML = "";

    const visibleKeys = visibleModuleKeys(state);

    if (!visibleKeys.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Wähle mindestens ein Modul aus, um Datensätze zu bearbeiten.";
      moduleTabs.append(empty);
      return;
    }

    visibleKeys.forEach((moduleKey) => {
      const recordErrorCount = (validation.moduleErrors[moduleKey] || []).reduce(
        (sum, recordErrors) => sum + recordErrors.length,
        0,
      );
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab-button${moduleKey === activeModuleKey ? " active" : ""}`;
      button.textContent = `${MODULE_MAP[moduleKey].label} (${state.records[moduleKey].length})${recordErrorCount ? ` • ${recordErrorCount}` : ""}`;
      button.addEventListener("click", () => {
        activeModuleKey = moduleKey;
        activePreviewGroupKey = moduleKey;
        render(store.getState());
      });
      moduleTabs.append(button);
    });
  }

  function renderModuleEditor(state, validation) {
    moduleEditor.innerHTML = "";

    if (!visibleModuleKeys(state).length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Keine Module ausgewählt.";
      moduleEditor.append(empty);
      return;
    }

    const moduleDefinition = MODULE_MAP[activeModuleKey];
    const documents = state.documents?.[activeModuleKey]?.length
      ? state.documents[activeModuleKey]
      : [{ id: `${activeModuleKey}-fallback`, name: "custom.yaml" }];
    if (!activeDocumentIds[activeModuleKey] || !documents.some((docEntry) => docEntry.id === activeDocumentIds[activeModuleKey])) {
      activeDocumentIds[activeModuleKey] = documents[0]?.id || null;
    }
    const activeDocumentId = activeDocumentIds[activeModuleKey];
    const stack = document.createElement("div");
    stack.className = "module-editor-stack";

    const actions = document.createElement("div");
    actions.className = "module-actions";

    const summary = document.createElement("p");
    summary.className = "module-summary";
    const moduleErrorCount = (validation.moduleErrors[activeModuleKey] || []).reduce(
      (sum, recordErrors) => sum + recordErrors.length,
      0,
    );
    summary.textContent = `${moduleDefinition.description}${moduleErrorCount ? ` • ${moduleErrorCount} Validierungsprobleme` : ""}`;

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "secondary-button";
    addButton.textContent = "Eintrag hinzufügen";
    addButton.addEventListener("click", () => {
      store.addRecord(activeModuleKey, activeDocumentId);
    });

    const addDocumentButton = document.createElement("button");
    addDocumentButton.type = "button";
    addDocumentButton.className = "icon-button";
    addDocumentButton.textContent = "+";
    addDocumentButton.title = "Neue Datei anlegen";
    addDocumentButton.setAttribute("aria-label", "Neue Datei anlegen");
    addDocumentButton.addEventListener("click", () => {
      const fileName = window.prompt("Neuer Dateiname, z.B. colonoscopy.yaml", `${activeModuleKey.replace(/^lx_/, "")}.yaml`);
      if (!fileName) {
        return;
      }
      store.addDocument(activeModuleKey, fileName);
      const nextState = store.getState();
      const nextDocument = nextState.documents[activeModuleKey][nextState.documents[activeModuleKey].length - 1];
      if (nextDocument) {
        activeDocumentIds[activeModuleKey] = nextDocument.id;
        activePreviewGroupKey = activeModuleKey;
        activeFilePath = `${activeModuleKey}/data/${nextDocument.name}`;
      }
      render(store.getState());
    });

    const removeDocumentButton = document.createElement("button");
    removeDocumentButton.type = "button";
    removeDocumentButton.className = "icon-button";
    removeDocumentButton.textContent = "-";
    removeDocumentButton.title = "Aktive Datei entfernen";
    removeDocumentButton.setAttribute("aria-label", "Aktive Datei entfernen");
    removeDocumentButton.disabled = documents.length <= 1;
    removeDocumentButton.addEventListener("click", () => {
      const activeDocument = documents.find((docEntry) => docEntry.id === activeDocumentId);
      if (!activeDocument || documents.length <= 1) {
        return;
      }
      const confirmed = window.confirm(
        `Datei ${activeDocument.name} entfernen? Zugeordnete Einträge werden in eine verbleibende Datei verschoben.`,
      );
      if (!confirmed) {
        return;
      }
      store.removeDocument(activeModuleKey, activeDocument.id);
      const nextState = store.getState();
      const fallbackDocument = nextState.documents[activeModuleKey][0];
      if (fallbackDocument) {
        activeDocumentIds[activeModuleKey] = fallbackDocument.id;
        activePreviewGroupKey = activeModuleKey;
        activeFilePath = `${activeModuleKey}/data/${fallbackDocument.name}`;
      }
      render(store.getState());
    });

    const documentButtonGroup = document.createElement("div");
    documentButtonGroup.className = "document-button-group";
    documentButtonGroup.append(addDocumentButton, removeDocumentButton);

    actions.append(summary, documentButtonGroup, addButton);
    stack.append(actions);

    const documentToolbar = document.createElement("div");
    documentToolbar.className = "document-toolbar";

    const documentMeta = document.createElement("div");
    documentMeta.className = "document-meta";

    const documentLabel = document.createElement("p");
    documentLabel.className = "document-label";
    documentLabel.textContent = "Dokumente";

    const documentHint = document.createElement("p");
    documentHint.className = "document-hint";
    documentHint.textContent = "Wähle oder benenne die YAML-Datei für dieses Modul.";

    documentMeta.append(documentLabel, documentHint);

    const documentTabs = document.createElement("div");
    documentTabs.className = "tab-strip document-tabs";
    documents.forEach((docEntry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab-button${docEntry.id === activeDocumentId ? " active" : ""}${docEntry.name === "custom.yaml" ? " subtle-tab" : ""}`;
      button.textContent = docEntry.name;
      button.addEventListener("click", () => {
        activeDocumentIds[activeModuleKey] = docEntry.id;
        activePreviewGroupKey = activeModuleKey;
        activeFilePath = `${activeModuleKey}/data/${docEntry.name}`;
        render(store.getState());
      });
      documentTabs.append(button);
    });

    documentToolbar.append(documentMeta, documentTabs);
    stack.append(documentToolbar);

    const renameDocumentButton = document.createElement("button");
    renameDocumentButton.type = "button";
    renameDocumentButton.className = "ghost-button";
    renameDocumentButton.textContent = "Datei umbenennen";
    renameDocumentButton.addEventListener("click", () => {
      const activeDocument = documents.find((docEntry) => docEntry.id === activeDocumentId);
      if (!activeDocument) {
        return;
      }
      const fileName = window.prompt("Neuer Dateiname", activeDocument.name);
      if (!fileName) {
        return;
      }
      store.renameDocument(activeModuleKey, activeDocument.id, fileName);
      const nextState = store.getState();
      const renamedDocument = nextState.documents[activeModuleKey].find((docEntry) => docEntry.id === activeDocument.id);
      if (renamedDocument) {
        activeFilePath = `${activeModuleKey}/data/${renamedDocument.name}`;
      }
      render(store.getState());
    });
    stack.append(renameDocumentButton);

    const visibleRecords = state.records[activeModuleKey]
      .map((record, actualIndex) => ({ record, actualIndex }))
      .filter(({ record }) => record._documentId === activeDocumentId);

    if (!visibleRecords.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = `Noch keine ${moduleDefinition.label.toLowerCase()} in dieser Datei. Füge den ersten Eintrag hinzu.`;
      stack.append(empty);
    }

    visibleRecords.forEach(({ record, actualIndex }, recordIndex) => {
      const fragment = cardTemplate.content.cloneNode(true);
      const title = fragment.querySelector("h3");
      const kicker = fragment.querySelector(".record-kicker");
      const fields = fragment.querySelector(".record-fields");
      const recordErrors = validation.moduleErrors[activeModuleKey]?.[actualIndex] || [];

      kicker.textContent = `Eintrag ${recordIndex + 1}${recordErrors.length ? ` • ${recordErrors.length} Fehler` : ""}`;
      title.textContent = record.name || "Unbenannter Eintrag";

      fragment.querySelector(".delete-record-button").addEventListener("click", () => {
        store.removeRecord(activeModuleKey, actualIndex);
      });

      fragment.querySelector(".duplicate-record-button").addEventListener("click", () => {
        store.duplicateRecord(activeModuleKey, actualIndex);
      });

      moduleDefinition.fields.forEach((fieldDefinition) => {
        fields.append(createField(fieldDefinition, record, recordErrors, actualIndex, title));
      });

      stack.append(fragment);
    });

    moduleEditor.append(stack);
  }

  function createField(fieldDefinition, record, recordErrors, recordIndex, title) {
    const wrapper = document.createElement("div");
    wrapper.className = `field${["textarea", "tags", "reference-tags", "json", "json-list"].includes(fieldDefinition.type) ? " field-full" : ""}`;

    const label = document.createElement("label");
    label.textContent = fieldDefinition.label;
    wrapper.append(label);

    let input;

    if (fieldDefinition.type === "textarea") {
      input = document.createElement("textarea");
      input.value = record[fieldDefinition.key] || "";
      input.placeholder = fieldDefinition.placeholder || "";
      input.addEventListener("input", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value, { emit: false });
        if (fieldDefinition.key === "name") {
          title.textContent = event.target.value || "Unbenannter Eintrag";
        }
        refreshDerivedViews();
      });
    } else if (fieldDefinition.type === "reference") {
      input = createReferenceInput(fieldDefinition, record, recordIndex, title);
    } else if (fieldDefinition.type === "select") {
      input = document.createElement("select");
      fieldDefinition.options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel(optionValue);
        input.append(option);
      });
      input.value = record[fieldDefinition.key] || fieldDefinition.options[0];
      input.addEventListener("change", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value);
      });
    } else if (fieldDefinition.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = record[fieldDefinition.key] === true;
      input.addEventListener("change", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.checked);
        refreshDerivedViews();
      });
    } else if (fieldDefinition.type === "reference-tags") {
      input = createReferenceTagsInput(fieldDefinition, record, recordIndex);
    } else if (fieldDefinition.type === "json" || fieldDefinition.type === "json-list") {
      input = document.createElement("textarea");
      input.placeholder = fieldDefinition.placeholder || "";
      const fieldValue = record[fieldDefinition.key];
      input.value =
        fieldDefinition.type === "json-list"
          ? Array.isArray(fieldValue)
            ? JSON.stringify(fieldValue, null, 2)
            : ""
          : fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)
            ? JSON.stringify(fieldValue, null, 2)
            : "";
      input.addEventListener("input", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value, { emit: false });
        refreshDerivedViews();
      });
    } else {
      input = document.createElement("input");
      input.type = fieldDefinition.type === "number" ? "number" : "text";
      input.placeholder = fieldDefinition.placeholder || "";
      input.value =
        fieldDefinition.type === "tags" ? (record[fieldDefinition.key] || []).join(", ") : (record[fieldDefinition.key] ?? "");
      input.addEventListener("input", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value, { emit: false });
        if (fieldDefinition.key === "name") {
          title.textContent = event.target.value || "Unbenannter Eintrag";
        }
        refreshDerivedViews();
      });
    }

    const hint = document.createElement("p");
    hint.className = "field-hint";
    let defaultHint = "Optional, sofern der nachgelagerte Validator das Feld nicht verlangt.";
    if (fieldDefinition.type === "tags") {
      defaultHint = "Werte durch Kommas trennen.";
    } else if (fieldDefinition.type === "reference-tags") {
      defaultHint = "Einträge aus der Liste auswählen.";
    } else if (fieldDefinition.type === "reference") {
      defaultHint = "Eintrag aus der Liste auswählen.";
    } else if (fieldDefinition.type === "json") {
      defaultHint = "JSON-Objekt eingeben.";
    } else if (fieldDefinition.type === "json-list") {
      defaultHint = "JSON-Liste eingeben.";
    } else if (fieldDefinition.type === "boolean") {
      defaultHint = "Häkchen setzen, wenn ja.";
    }
    hint.textContent = recordErrors.find((error) => error.startsWith(fieldDefinition.label)) || defaultHint;

    wrapper.append(input, hint);
    return wrapper;
  }

  function createReferenceInput(fieldDefinition, record, recordIndex, title) {
    const select = document.createElement("select");
    const currentValue = record[fieldDefinition.key] || "";
    const sourceRecords = (store.getState().records?.[fieldDefinition.sourceModule] || []).filter((sourceRecord) =>
      String(sourceRecord?.name || "").trim(),
    );

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = fieldDefinition.placeholder || "Eintrag auswählen";
    select.append(placeholder);

    const optionValues = new Set();
    sourceRecords.forEach((sourceRecord) => {
      optionValues.add(sourceRecord.name);
      const option = document.createElement("option");
      option.value = sourceRecord.name;
      option.textContent =
        sourceRecord.name_de && sourceRecord.name_de !== sourceRecord.name
          ? `${sourceRecord.name_de} (${sourceRecord.name})`
          : sourceRecord.name;
      select.append(option);
    });

    if (currentValue && !optionValues.has(currentValue)) {
      const option = document.createElement("option");
      option.value = currentValue;
      option.textContent = currentValue;
      select.append(option);
    }

    select.value = currentValue;
    select.addEventListener("change", (event) => {
      store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value);
      if (fieldDefinition.key === "name") {
        title.textContent = event.target.value || "Unbenannter Eintrag";
      }
    });
    return select;
  }

  function createReferenceTagsInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "reference-picker";
    const selectedValues = Array.isArray(record[fieldDefinition.key]) ? record[fieldDefinition.key] : [];
    const sourceRecords = (store.getState().records?.[fieldDefinition.sourceModule] || []).filter((sourceRecord) =>
      String(sourceRecord?.name || "").trim(),
    );

    const select = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = fieldDefinition.placeholder || "Eintrag auswählen";
    select.append(placeholder);

    sourceRecords
      .filter((sourceRecord) => !selectedValues.includes(sourceRecord.name))
      .forEach((sourceRecord) => {
        const option = document.createElement("option");
        option.value = sourceRecord.name;
        option.textContent =
          sourceRecord.name_de && sourceRecord.name_de !== sourceRecord.name
            ? `${sourceRecord.name_de} (${sourceRecord.name})`
            : sourceRecord.name;
        select.append(option);
      });

    select.disabled = sourceRecords.length === 0 || sourceRecords.length === selectedValues.length;
    select.addEventListener("change", (event) => {
      const nextValue = event.target.value;
      if (!nextValue || selectedValues.includes(nextValue)) {
        return;
      }
      store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, [...selectedValues, nextValue]);
    });

    const chipList = document.createElement("div");
    chipList.className = "reference-chip-list";
    if (!selectedValues.length) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = sourceRecords.length ? "Noch keine Befunde ausgewählt." : "Bitte zuerst Befunde anlegen.";
      chipList.append(empty);
    }

    selectedValues.forEach((value) => {
      const sourceRecord = sourceRecords.find((candidate) => candidate.name === value);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "reference-chip";
      chip.textContent =
        sourceRecord?.name_de && sourceRecord.name_de !== value ? `${sourceRecord.name_de} ×` : `${value} ×`;
      chip.title = `${value} entfernen`;
      chip.addEventListener("click", () => {
        store.updateRecordField(
          activeModuleKey,
          recordIndex,
          fieldDefinition.key,
          selectedValues.filter((selectedValue) => selectedValue !== value),
        );
      });
      chipList.append(chip);
    });

    container.append(select, chipList);
    return container;
  }

  function renderPreview(state, previewGroups = buildPreviewGroups(state)) {
    const fileEntries = buildSerializedFiles(state);
    const activeGroup = previewGroups.find((group) => group.key === activePreviewGroupKey) || previewGroups[0];
    const filePaths = activeGroup ? activeGroup.files.map((file) => file.path) : [];

    if (!filePaths.includes(activeFilePath)) {
      activeFilePath = filePaths[0];
    }

    fileTabs.innerHTML = "";
    const contextTabs = document.createElement("div");
    contextTabs.className = "tab-strip preview-context-tabs";

    previewGroups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab-button${group.key === activePreviewGroupKey ? " active" : ""}`;
      button.textContent = group.label;
      button.addEventListener("click", () => {
        activePreviewGroupKey = group.key;
        activeFilePath = group.files[0]?.path || "config.yaml";
        renderPreview(store.getState());
      });
      contextTabs.append(button);
    });

    fileTabs.append(contextTabs);

    if (activeGroup) {
      const groupElement = document.createElement("section");
      groupElement.className = "preview-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "preview-group-header";

      const titleBlock = document.createElement("div");
      const title = document.createElement("p");
      title.className = "preview-group-title";
      title.textContent = activeGroup.label;

      const description = document.createElement("p");
      description.className = "preview-group-description";
      description.textContent = activeGroup.description;

      titleBlock.append(title, description);
      groupHeader.append(titleBlock);

      const groupTabs = document.createElement("div");
      groupTabs.className = "tab-strip preview-group-tabs";

      activeGroup.files.forEach((file) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tab-button${file.path === activeFilePath ? " active" : ""}${file.emphasis === "low" ? " subtle-tab" : ""}`;
        button.textContent = file.label;
        button.addEventListener("click", () => {
          activeFilePath = file.path;
          if (file.documentId && activeGroup.key !== "root") {
            activeDocumentIds[activeGroup.key] = file.documentId;
          }
          renderPreview(store.getState());
        });
        groupTabs.append(button);
      });

      groupElement.append(groupHeader, groupTabs);
      fileTabs.append(groupElement);
    }

    filePreview.textContent = activeFilePath ? fileEntries[activeFilePath] : "Keine Datei ausgewählt.";
  }

  function renderLintPanel() {
    if (!lintStatus || !lintOutput) {
      return;
    }
    lintStatus.textContent = lintState.summary;
    lintStatus.classList.toggle("is-ok", lintState.status === "ok");
    lintStatus.classList.toggle("is-error", lintState.status === "error");
    lintOutput.textContent = lintState.output;
    lintButtons.forEach((lintButton) => {
      lintButton.disabled = lintState.status === "running";
    });
  }

  function renderMergePanel() {
    if (!mergePanel) {
      return;
    }

    if (!pendingMergePlan) {
      mergePanel.hidden = true;
      mergePanel.innerHTML = "";
      return;
    }

    mergePanel.hidden = false;
    mergePanel.innerHTML = "";

    const header = document.createElement("div");
    header.className = "merge-header";
    const headerCopy = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "section-kicker";
    kicker.textContent = "Zusammenführen";
    const title = document.createElement("h2");
    title.textContent = "Unterschiede prüfen";
    const summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent = `${pendingMergePlan.additions.length} neue Einträge werden automatisch übernommen. ${pendingMergePlan.conflicts.length} Einträge brauchen eine Entscheidung.`;
    headerCopy.append(kicker, title, summary);

    const actions = document.createElement("div");
    actions.className = "merge-actions";
    const keepCurrentButton = document.createElement("button");
    keepCurrentButton.type = "button";
    keepCurrentButton.className = "ghost-button";
    keepCurrentButton.textContent = "Alle aktuellen behalten";
    keepCurrentButton.addEventListener("click", () => {
      mergeChoices = Object.fromEntries(pendingMergePlan.conflicts.map((conflict) => [conflict.id, "current"]));
      renderMergePanel();
    });

    const useIncomingButton = document.createElement("button");
    useIncomingButton.type = "button";
    useIncomingButton.className = "secondary-button";
    useIncomingButton.textContent = "Alle importierten übernehmen";
    useIncomingButton.addEventListener("click", () => {
      mergeChoices = Object.fromEntries(pendingMergePlan.conflicts.map((conflict) => [conflict.id, "incoming"]));
      renderMergePanel();
    });

    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "primary-button";
    applyButton.textContent = "Zusammenführen";
    applyButton.addEventListener("click", applyPendingMerge);

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "ghost-button";
    cancelButton.textContent = "Abbrechen";
    cancelButton.addEventListener("click", cancelPendingMerge);

    actions.append(keepCurrentButton, useIncomingButton, applyButton, cancelButton);
    header.append(headerCopy, actions);
    mergePanel.append(header);

    if (pendingMergePlan.additions.length) {
      const additions = document.createElement("p");
      additions.className = "merge-additions";
      additions.textContent = `Neue Einträge: ${pendingMergePlan.additions
        .slice(0, 8)
        .map((addition) => `${MODULE_MAP[addition.moduleKey].label}: ${addition.recordName}`)
        .join(", ")}${pendingMergePlan.additions.length > 8 ? " ..." : ""}`;
      mergePanel.append(additions);
    }

    const list = document.createElement("div");
    list.className = "merge-conflict-list";
    pendingMergePlan.conflicts.forEach((conflict) => {
      list.append(renderMergeConflict(conflict));
    });
    mergePanel.append(list);
  }

  function renderMergeConflict(conflict) {
    const card = document.createElement("article");
    card.className = "merge-conflict-card";

    const header = document.createElement("div");
    header.className = "merge-conflict-header";
    const titleBlock = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "record-kicker";
    kicker.textContent = MODULE_MAP[conflict.moduleKey].label;
    const title = document.createElement("h3");
    title.textContent = conflict.recordName;
    titleBlock.append(kicker, title);

    const choiceGroup = document.createElement("div");
    choiceGroup.className = "merge-choice-group";
    choiceGroup.append(
      createMergeChoiceButton(conflict, "current", "Aktuelle Version behalten"),
      createMergeChoiceButton(conflict, "incoming", "Importierte Version übernehmen"),
    );

    header.append(titleBlock, choiceGroup);
    card.append(header);

    const fields = document.createElement("div");
    fields.className = "merge-field-list";
    conflict.differences.forEach((difference) => {
      const row = document.createElement("div");
      row.className = "merge-field-row";

      const label = document.createElement("p");
      label.className = "merge-field-label";
      label.textContent = difference.label;

      const currentValue = document.createElement("div");
      currentValue.className = "merge-field-value";
      currentValue.innerHTML = `<strong>Aktuell</strong><span></span>`;
      currentValue.querySelector("span").textContent = formatMergeValue(difference.currentValue);

      const incomingValue = document.createElement("div");
      incomingValue.className = "merge-field-value";
      incomingValue.innerHTML = `<strong>Importiert</strong><span></span>`;
      incomingValue.querySelector("span").textContent = formatMergeValue(difference.incomingValue);

      row.append(label, currentValue, incomingValue);
      fields.append(row);
    });

    card.append(fields);
    return card;
  }

  function createMergeChoiceButton(conflict, choice, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tab-button${mergeChoices[conflict.id] === choice ? " active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => {
      mergeChoices[conflict.id] = choice;
      renderMergePanel();
    });
    return button;
  }
}

function buildSerializedFiles(state) {
  const fileObjects = buildFileObjects(state);
  return Object.fromEntries(Object.entries(fileObjects).map(([path, value]) => [path, stringifyYaml(value)]));
}

function showToast(message) {
  const currentToast = document.querySelector(".toast");
  if (currentToast) {
    currentToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2200);
}
