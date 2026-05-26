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
  exponential: "Exponentialverteilung",
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
  log_normal: "Log-Normalverteilung",
  missing: "muss fehlen",
  nephrology: "Nephrologie",
  neurology: "Neurologie",
  normal: "Normalverteilung",
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
  uniform: "Gleichverteilung",
  unknown: "nicht festgelegt",
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

const VALIDATOR_COMPARATOR_OPTIONS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "not_in"];
const VALIDATOR_COMPARATOR_LABELS = {
  eq: "gleich",
  ne: "nicht gleich",
  gt: "größer als",
  gte: "größer oder gleich",
  lt: "kleiner als",
  lte: "kleiner als oder gleich",
  in: "einer von",
  not_in: "keiner von",
};
const REQUIREMENT_KIND_OPTIONS = ["classification", "classification_choice", "finding", "intervention", "unit"];
const REQUIREMENT_KIND_LABELS = {
  classification: "Klassifikation",
  classification_choice: "Klassifikation-Auswahlwert",
  finding: "Befund",
  intervention: "Intervention",
  unit: "Einheit",
};
const REQUIREMENT_SOURCE_MODULES = {
  classification: "lx_classifications",
  classification_choice: "lx_classification_choices",
  finding: "lx_findings",
  intervention: "lx_interventions",
  unit: "lx_units",
};
const IMPORTANT_FIELD_KEYS = new Set(["name", "name_de", "name_en"]);
const CONCEPT_MODULE_ORDER = [
  "lx_examinations",
  "lx_findings",
  "lx_interventions",
  "lx_classifications",
  "lx_classification_choices",
  "lx_descriptors",
  "lx_units",
];
const CONCEPT_MODULE_TIER = {
  lx_examinations: "Examination",
  lx_findings: "Finding",
  lx_interventions: "Intervention",
  lx_classifications: "Classification",
  lx_classification_choices: "ClassificationChoice",
  lx_descriptors: "ClassificationDescriptor",
  lx_units: "Unit",
};

function optionLabel(value) {
  return FIELD_OPTION_LABELS[value] || VALIDATOR_COMPARATOR_LABELS[value] || REQUIREMENT_KIND_LABELS[value] || value;
}

export function mountApp({ store }) {
  const bundleForm = document.querySelector("#bundle-form");
  const modulePickers = document.querySelector("#module-pickers");
  const moduleTabs = document.querySelector("#module-tabs");
  const moduleEditor = document.querySelector("#module-editor");
  const sectionToggleButtons = document.querySelectorAll("[data-section-toggle]");
  const fileTabs = document.querySelector("#file-tabs");
  const filePreview = document.querySelector("#file-preview");
  const conceptSearchInput = document.querySelector("#concept-search-input");
  const conceptSearchResults = document.querySelector("#concept-search-results");
  const findingSuggestions = document.querySelector("#finding-suggestions");
  const shareButton = document.querySelector("#share-button");
  const downloadButton = document.querySelector("#download-button");
  const zipDownloadButtons = document.querySelectorAll('[data-action="zip-download"]');
  const zipOpenButton = document.querySelector("#zip-open-button");
  const zipMergeButton = document.querySelector("#zip-merge-button");
  const zipImportInput = document.querySelector("#zip-import-input");
  const mergePanel = document.querySelector("#merge-panel");
  const lintButtons = document.querySelectorAll('[data-action="lint"]');
  const resetButton = document.querySelector("#reset-button");
  const emptyResetButton = document.querySelector("#empty-reset-button");
  const cardTemplate = document.querySelector("#record-card-template");
  const lintStatus = document.querySelector("#lint-status");
  const lintOutput = document.querySelector("#lint-output");

  let activeModuleKey = store.getState().bundle.modules[0] || "lx_examinations";
  let activePreviewGroupKey = "root";
  let activeFilePath = "config.yaml";
  const activeDocumentIds = {};
  const collapsedFieldKeys = new Set();
  const expandedFieldKeys = new Set();
  const openInfoKeys = new Set();
  const expandedTreeNodes = new Set(["files", "hierarchy"]);
  const collapsedSectionKeys = new Set(["module-pickers"]);
  const collapsedRecordKeys = new Set();
  let conceptSearchQuery = "";
  let pendingFocusRecordKey = "";
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

  zipDownloadButtons.forEach((zipDownloadButton) => {
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
    resetTransientUiState();
    store.reset();
    focusFirstModule();
    render(store.getState());
    showToast("Beispielpaket wiederhergestellt.");
  });

  emptyResetButton?.addEventListener("click", () => {
    resetTransientUiState();
    store.resetEmpty();
    focusFirstModule();
    render(store.getState());
    showToast("Leeres Paket angelegt.");
  });

  conceptSearchInput?.addEventListener("input", (event) => {
    conceptSearchQuery = event.target.value;
    renderConceptSearch(store.getState());
  });

  sectionToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionKey = button.dataset.sectionToggle;
      if (!sectionKey) {
        return;
      }
      if (collapsedSectionKeys.has(sectionKey)) {
        collapsedSectionKeys.delete(sectionKey);
      } else {
        collapsedSectionKeys.add(sectionKey);
      }
      syncCollapsibleSections();
    });
  });

  store.subscribe(render);
  render(store.getState());

  function resetTransientUiState() {
    pendingMergePlan = null;
    mergeChoices = {};
    Object.keys(activeDocumentIds).forEach((moduleKey) => {
      delete activeDocumentIds[moduleKey];
    });
    collapsedFieldKeys.clear();
    expandedFieldKeys.clear();
    openInfoKeys.clear();
    expandedTreeNodes.clear();
    expandedTreeNodes.add("files");
    expandedTreeNodes.add("hierarchy");
    collapsedSectionKeys.clear();
    collapsedSectionKeys.add("module-pickers");
    collapsedRecordKeys.clear();
    conceptSearchQuery = "";
    if (conceptSearchInput) {
      conceptSearchInput.value = "";
    }
    lintState = {
      status: "idle",
      summary: "Noch nicht geprüft.",
      output: "Noch keine Prüfausgabe.",
    };
  }

  function syncCollapsibleSections() {
    document.querySelectorAll("[data-collapsible-section]").forEach((section) => {
      const sectionKey = section.dataset.collapsibleSection;
      const collapsed = collapsedSectionKeys.has(sectionKey);
      section.classList.toggle("is-collapsed", collapsed);
      const body = section.querySelector("[data-section-body]");
      if (body) {
        body.hidden = collapsed;
      }
      const toggle = section.querySelector("[data-section-toggle]");
      if (toggle) {
        toggle.textContent = collapsed ? "+" : "-";
        toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
        toggle.title = collapsed ? "Ausklappen" : "Einklappen";
      }
    });
  }

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
      renderConceptSearch(state);
      renderFindingSuggestions(state);
      renderModuleEditor(state, validation);
      renderPreview(state, previewGroups);
      renderLintPanel();
      renderMergePanel();
      syncCollapsibleSections();
      scrollPendingRecordIntoView();
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

      const errorText = validation.bundleFieldErrors?.[fieldDefinition.key]?.join(" ") || "";
      bundleForm.append(
        createFieldShell({
          fieldKey: `bundle:${fieldDefinition.key}`,
          labelText: fieldDefinition.label,
          input,
          hintText: fieldDefinition.hint,
          errorText,
          full: fieldDefinition.full,
          defaultExpanded: IMPORTANT_FIELD_KEYS.has(fieldDefinition.key) || ["version", "medical_field"].includes(fieldDefinition.key) || Boolean(errorText),
        }),
      );
    });
  }

  function createFieldShell({ fieldKey, labelText, input, hintText, errorText = "", full = false, defaultExpanded = false }) {
    const wrapper = document.createElement("div");
    const expanded = isFieldExpanded(fieldKey, defaultExpanded);
    const infoOpen = openInfoKeys.has(fieldKey);
    wrapper.className = `field${full ? " field-full" : ""}${expanded ? "" : " is-collapsed"}${errorText ? " has-error" : ""}`;

    const header = document.createElement("div");
    header.className = "field-header";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "field-toggle";
    toggle.textContent = expanded ? "-" : "+";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.addEventListener("click", () => {
      if (expanded) {
        collapsedFieldKeys.add(fieldKey);
        expandedFieldKeys.delete(fieldKey);
      } else {
        expandedFieldKeys.add(fieldKey);
        collapsedFieldKeys.delete(fieldKey);
      }
      render(store.getState());
    });

    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = labelText;

    const infoButton = document.createElement("button");
    infoButton.type = "button";
    infoButton.className = `info-button${infoOpen ? " active" : ""}`;
    infoButton.textContent = "i";
    infoButton.title = "Helfertext anzeigen";
    infoButton.setAttribute("aria-label", `${labelText}: Helfertext anzeigen`);
    infoButton.addEventListener("click", () => {
      if (openInfoKeys.has(fieldKey)) {
        openInfoKeys.delete(fieldKey);
      } else {
        openInfoKeys.add(fieldKey);
      }
      render(store.getState());
    });

    header.append(toggle, label, infoButton);
    wrapper.append(header);

    const body = document.createElement("div");
    body.className = "field-body";
    if (expanded) {
      body.append(input);
    }

    const hint = document.createElement("p");
    hint.className = `field-hint${errorText ? " field-error" : ""}`;
    hint.textContent = errorText || hintText;
    if (errorText || infoOpen) {
      body.append(hint);
    }

    wrapper.append(body);
    return wrapper;
  }

  function isFieldExpanded(fieldKey, defaultExpanded) {
    if (collapsedFieldKeys.has(fieldKey)) {
      return false;
    }
    if (expandedFieldKeys.has(fieldKey)) {
      return true;
    }
    return defaultExpanded;
  }

  function renderModulePickers(state) {
    modulePickers.innerHTML = "";

    Object.values(MODULE_MAP)
      .filter((moduleDefinition) => !moduleDefinition.hidden)
      .forEach((moduleDefinition) => {
        const infoKey = `module-picker:${moduleDefinition.key}`;
        const infoOpen = openInfoKeys.has(infoKey);
        const card = document.createElement("div");
        card.className = `picker-card${infoOpen ? " info-open" : ""}`;

        const header = document.createElement("div");
        header.className = "picker-card-header";
        const label = document.createElement("label");
        label.className = "picker-card-title";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.bundle.modules.includes(moduleDefinition.key);
        checkbox.addEventListener("change", () => {
          store.toggleModule(moduleDefinition.key, checkbox.checked);
        });

        label.append(checkbox, document.createTextNode(moduleDefinition.label));
        const infoButton = document.createElement("button");
        infoButton.type = "button";
        infoButton.className = `info-button${infoOpen ? " active" : ""}`;
        infoButton.textContent = "i";
        infoButton.title = "Modulinfo anzeigen";
        infoButton.setAttribute("aria-label", `${moduleDefinition.label}: Modulinfo anzeigen`);
        infoButton.addEventListener("click", () => {
          if (openInfoKeys.has(infoKey)) {
            openInfoKeys.delete(infoKey);
          } else {
            openInfoKeys.add(infoKey);
          }
          renderModulePickers(store.getState());
        });
        header.append(label, infoButton);
        card.append(header);

        const section = document.createElement("p");
        section.className = "picker-section";
        section.textContent = `Sektion: Datensätze / ${moduleDefinition.label}`;
        card.append(section);

        if (infoOpen) {
          const description = document.createElement("p");
          description.className = "picker-info";
          description.textContent = `${moduleDefinition.description} In der Modulauswahl aktivierst du das Modul; im Datensatzbereich bearbeitest du Einträge; in der Vorschau findest du die erzeugten YAML-Dateien und Konzeptverweise.`;
          card.append(description);
        }
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

  function renderConceptSearch(state) {
    if (!conceptSearchResults) {
      return;
    }
    conceptSearchResults.innerHTML = "";
    const results = buildConceptSearchResults(state, conceptSearchQuery).slice(0, 12);

    if (!conceptSearchQuery.trim()) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = "Suche nach Konzepten, Dateien, Modulen oder Referenzen im aktuellen Paket.";
      conceptSearchResults.append(empty);
      return;
    }

    if (!results.length) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = "Keine passenden Konzepte gefunden.";
      conceptSearchResults.append(empty);
      return;
    }

    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "concept-result";
      button.setAttribute("role", "listitem");
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = result.title;
      button.querySelector("span").textContent = result.meta;
      button.addEventListener("click", () => {
        conceptSearchQuery = result.title;
        if (conceptSearchInput) {
          conceptSearchInput.value = result.title;
        }
        focusRecord(result.moduleKey, result.recordIndex);
      });
      conceptSearchResults.append(button);
    });
  }

  function buildConceptSearchResults(state, query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return [];
    }

    const results = [];
    state.bundle.modules
      .filter((moduleKey) => !MODULE_MAP[moduleKey]?.hidden)
      .forEach((moduleKey) => {
        const moduleDefinition = MODULE_MAP[moduleKey];
        const documents = state.documents?.[moduleKey] || [];
        (state.records?.[moduleKey] || []).forEach((record, recordIndex) => {
          const documentName = documents.find((document) => document.id === record._documentId)?.name || "custom.yaml";
          const values = [
            moduleDefinition.label,
            moduleDefinition.key,
            documentName,
            record.name,
            record.name_de,
            record.name_en,
            record.description,
            ...moduleDefinition.fields.flatMap((fieldDefinition) => {
              const value = record[fieldDefinition.key];
              return Array.isArray(value) ? value : [];
            }),
          ];
          const haystack = normalizeSearchText(values.join(" "));
          if (!haystack.includes(normalizedQuery)) {
            return;
          }
          results.push({
            moduleKey,
            recordIndex,
            title: recordDisplayName(record) || record.name || "Unbenannter Eintrag",
            meta: `${moduleDefinition.label} / ${documentName}`,
          });
        });
      });
    return results;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function renderFindingSuggestions(state) {
    if (!findingSuggestions) {
      return;
    }
    findingSuggestions.innerHTML = "";
    const suggestions = buildMissingFindingSuggestions(state);
    if (!suggestions.length) {
      findingSuggestions.hidden = true;
      return;
    }

    findingSuggestions.hidden = false;
    const header = document.createElement("div");
    header.className = "suggestion-header";
    const title = document.createElement("p");
    title.className = "document-label";
    title.textContent = "Vorschläge für neue Befunde";
    const description = document.createElement("p");
    description.className = "document-hint";
    description.textContent = "Fehlende Befunde aus vorhandenen Referenzen übernehmen.";
    header.append(title, description);

    const list = document.createElement("div");
    list.className = "suggestion-list";
    suggestions.slice(0, 8).forEach((suggestion) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-chip";
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = suggestion.name;
      button.querySelector("span").textContent = suggestion.sources.join(", ");
      button.addEventListener("click", () => {
        const findingDocumentId =
          activeModuleKey === "lx_findings"
            ? activeDocumentIds.lx_findings || state.documents.lx_findings?.[0]?.id
            : state.documents.lx_findings?.[0]?.id;
        store.addRecordWithValues("lx_findings", findingDocumentId, {
          name: suggestion.name,
          name_de: humanizeConceptName(suggestion.name),
          finding_types: ["observation"],
        });
        const nextState = store.getState();
        const newIndex = nextState.records.lx_findings.length - 1;
        focusRecord("lx_findings", newIndex);
        showToast("Befund angelegt.");
      });
      list.append(button);
    });

    findingSuggestions.append(header, list);
  }

  function buildMissingFindingSuggestions(state) {
    const existingFindings = new Set((state.records.lx_findings || []).map((record) => record.name).filter(Boolean));
    const references = new Map();
    const addReference = (name, source) => {
      const normalizedName = String(name || "").trim();
      if (!normalizedName || existingFindings.has(normalizedName)) {
        return;
      }
      if (!references.has(normalizedName)) {
        references.set(normalizedName, new Set());
      }
      references.get(normalizedName).add(source);
    };

    (state.records.lx_examinations || []).forEach((record) => {
      (Array.isArray(record.findings) ? record.findings : []).forEach((name) => {
        addReference(name, record.name ? `Untersuchung ${record.name}` : "Untersuchung");
      });
    });
    (state.records.lx_report_templates || []).forEach((record) => {
      (Array.isArray(record.report_findings) ? record.report_findings : []).forEach((name) => {
        addReference(name, record.name ? `Bericht ${record.name}` : "Bericht");
      });
    });
    (state.records.lx_report_template_sections || []).forEach((record) => {
      (Array.isArray(record.findings) ? record.findings : []).forEach((name) => {
        addReference(name, record.name ? `Berichtsabschnitt ${record.name}` : "Berichtsabschnitt");
      });
    });

    return [...references.entries()].map(([name, sources]) => ({ name, sources: [...sources] }));
  }

  function humanizeConceptName(value) {
    return String(value || "")
      .replace(/^lx_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function focusRecord(moduleKey, recordIndex) {
    const nextState = store.getState();
    const record = nextState.records?.[moduleKey]?.[recordIndex];
    if (!record) {
      return;
    }
    if (!MODULE_MAP[moduleKey]?.hidden) {
      activeModuleKey = moduleKey;
    }
    activePreviewGroupKey = moduleKey;
    const document = nextState.documents?.[moduleKey]?.find((entry) => entry.id === record._documentId);
    if (document) {
      activeDocumentIds[moduleKey] = document.id;
      activeFilePath = `${moduleKey}/data/${document.name}`;
    }
    expandedTreeNodes.add(moduleKey);
    collapsedSectionKeys.delete("records");
    pendingFocusRecordKey = getRecordDomKey(moduleKey, recordIndex);
    collapsedRecordKeys.delete(pendingFocusRecordKey);
    render(nextState);
  }

  function getRecordDomKey(moduleKey, recordIndex) {
    return `${moduleKey}-${recordIndex}`;
  }

  function scrollPendingRecordIntoView() {
    if (!pendingFocusRecordKey) {
      return;
    }
    const recordElement = moduleEditor.querySelector(`[data-record-key="${pendingFocusRecordKey}"]`);
    pendingFocusRecordKey = "";
    if (!recordElement) {
      return;
    }
    recordElement.classList.add("is-focused");
    recordElement.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      recordElement.classList.remove("is-focused");
    }, 1400);
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
    addButton.textContent = "Neuer Eintrag";
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
      const card = fragment.querySelector(".record-card");
      const title = fragment.querySelector("h3");
      const kicker = fragment.querySelector(".record-kicker");
      const fields = fragment.querySelector(".record-fields");
      const recordActions = fragment.querySelector(".record-actions");
      const recordErrors = validation.moduleErrors[activeModuleKey]?.[actualIndex] || [];
      const recordKey = getRecordDomKey(activeModuleKey, actualIndex);
      const isRecordCollapsed = collapsedRecordKeys.has(recordKey);

      card.dataset.recordKey = recordKey;
      card.classList.toggle("is-collapsed", isRecordCollapsed);
      kicker.textContent = `Eintrag ${recordIndex + 1}${recordErrors.length ? ` • ${recordErrors.length} Fehler` : ""}`;
      title.textContent = record.name || "Unbenannter Eintrag";

      const collapseRecordButton = document.createElement("button");
      collapseRecordButton.className = "ghost-button record-collapse-button";
      collapseRecordButton.type = "button";
      collapseRecordButton.textContent = isRecordCollapsed ? "Öffnen" : "Einklappen";
      collapseRecordButton.setAttribute("aria-expanded", isRecordCollapsed ? "false" : "true");
      collapseRecordButton.addEventListener("click", () => {
        if (collapsedRecordKeys.has(recordKey)) {
          collapsedRecordKeys.delete(recordKey);
        } else {
          collapsedRecordKeys.add(recordKey);
        }
        render(store.getState());
      });
      recordActions.prepend(collapseRecordButton);

      fragment.querySelector(".delete-record-button").addEventListener("click", () => {
        store.removeRecord(activeModuleKey, actualIndex);
      });

      fragment.querySelector(".duplicate-record-button").addEventListener("click", () => {
        store.duplicateRecord(activeModuleKey, actualIndex);
      });

      moduleDefinition.fields.forEach((fieldDefinition) => {
        fields.append(createField(fieldDefinition, record, recordErrors, actualIndex, title));
      });
      fields.hidden = isRecordCollapsed;

      stack.append(fragment);
    });

    moduleEditor.append(stack);
  }

  function createField(fieldDefinition, record, recordErrors, recordIndex, title) {
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
    } else if (fieldDefinition.type === "validator-rule") {
      input = createValidatorRuleInput(fieldDefinition, record, recordIndex);
    } else if (fieldDefinition.type === "numeric-distribution-params") {
      input = createNumericDistributionParamsInput(fieldDefinition, record, recordIndex);
    } else if (fieldDefinition.type === "selection-default-options") {
      input = createSelectionDefaultOptionsInput(fieldDefinition, record, recordIndex);
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
    } else if (fieldDefinition.type === "tags") {
      input = createTagsInput(fieldDefinition, record, recordIndex);
    } else {
      input = document.createElement("input");
      input.type = fieldDefinition.type === "number" ? "number" : "text";
      input.placeholder = fieldDefinition.placeholder || "";
      input.value = record[fieldDefinition.key] ?? "";
      input.addEventListener("input", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value, { emit: false });
        if (fieldDefinition.key === "name") {
          title.textContent = event.target.value || "Unbenannter Eintrag";
        }
        refreshDerivedViews();
      });
    }

    let defaultHint = "Optional, sofern der nachgelagerte Validator das Feld nicht verlangt.";
    if (fieldDefinition.type === "tags") {
      defaultHint = "Werte durch Kommas trennen.";
    } else if (fieldDefinition.type === "reference-tags") {
      defaultHint = "Einträge aus den im aktuellen Paket angelegten Dateien auswählen.";
    } else if (fieldDefinition.type === "reference") {
      defaultHint = "Eintrag aus den im aktuellen Paket angelegten Dateien auswählen.";
    } else if (fieldDefinition.type === "json") {
      defaultHint = "JSON-Objekt eingeben.";
    } else if (fieldDefinition.type === "json-list") {
      defaultHint = "JSON-Liste eingeben.";
    } else if (fieldDefinition.type === "validator-rule") {
      defaultHint = "Der Textbaustein wird aus der Regel erzeugt und als lx-data-models-Regel exportiert.";
    } else if (fieldDefinition.type === "numeric-distribution-params") {
      defaultHint = "Die Eingaben werden als lx-data-models-Verteilungsparameter exportiert.";
    } else if (fieldDefinition.type === "selection-default-options") {
      defaultHint = "Eine Zeile pro Option, z.B. adenoma = 1. Das Auswahlmenü nutzt die hier angelegten Auswahloptionen.";
    } else if (fieldDefinition.type === "boolean") {
      defaultHint = "Häkchen setzen, wenn ja.";
    }
    const errorText = recordErrors.find((error) => error.startsWith(fieldDefinition.label)) || "";
    const isFullWidth = [
      "textarea",
      "tags",
      "reference-tags",
      "json",
      "json-list",
      "validator-rule",
      "numeric-distribution-params",
      "selection-default-options",
    ].includes(fieldDefinition.type);

    return createFieldShell({
      fieldKey: `record:${activeModuleKey}:${record._documentId || "document"}:${recordIndex}:${fieldDefinition.key}`,
      labelText: fieldDefinition.label,
      input,
      hintText: defaultHint,
      errorText,
      full: isFullWidth,
      defaultExpanded: fieldDefinition.required || IMPORTANT_FIELD_KEYS.has(fieldDefinition.key) || Boolean(errorText),
    });
  }

  function createTagsInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "tag-box";
    const values = Array.isArray(record[fieldDefinition.key]) ? record[fieldDefinition.key] : [];
    const sourceRecords = fieldDefinition.sourceModule ? getSourceRecords(fieldDefinition.sourceModule) : [];
    const optionValues = sourceRecords
      .map((sourceRecord) => sourceRecord.name)
      .filter((value) => value && !values.includes(value));
    const datalistId = `tag-options-${activeModuleKey}-${recordIndex}-${fieldDefinition.key}`;

    const chipList = document.createElement("div");
    chipList.className = "tag-chip-list";
    if (!values.length) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = "Noch keine Werte eingetragen.";
      chipList.append(empty);
    }

    values.forEach((value) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.textContent = `${displayNameFor(fieldDefinition.sourceModule, value) || value} x`;
      chip.title = `${value} entfernen`;
      chip.addEventListener("click", () => {
        store.updateRecordField(
          activeModuleKey,
          recordIndex,
          fieldDefinition.key,
          values.filter((candidate) => candidate !== value),
        );
      });
      chipList.append(chip);
    });

    const inputRow = document.createElement("div");
    inputRow.className = "tag-input-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = fieldDefinition.placeholder || "Wert eingeben";
    if (optionValues.length) {
      input.setAttribute("list", datalistId);
    }

    const addValues = (rawValue) => {
      const nextValues = mergeUniqueValues([...values, ...splitTagInput(rawValue)]);
      if (nextValues.length !== values.length) {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, nextValues);
      }
      input.value = "";
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addValues(input.value);
      }
    });
    input.addEventListener("paste", (event) => {
      const text = event.clipboardData?.getData("text") || "";
      if (text.includes(",") || text.includes("\n")) {
        event.preventDefault();
        addValues(text);
      }
    });
    input.addEventListener("blur", () => {
      if (input.value.trim()) {
        addValues(input.value);
      }
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "ghost-button tag-add-button";
    addButton.textContent = "Hinzufügen";
    addButton.addEventListener("click", () => addValues(input.value));

    inputRow.append(input, addButton);

    if (optionValues.length) {
      const datalist = document.createElement("datalist");
      datalist.id = datalistId;
      optionValues.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.label = displayNameFor(fieldDefinition.sourceModule, value) || value;
        datalist.append(option);
      });
      inputRow.append(datalist);
    }

    container.append(chipList, inputRow);
    return container;
  }

  function splitTagInput(value) {
    return String(value || "")
      .split(/,|\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function getSourceRecords(moduleKey) {
    return (store.getState().records?.[moduleKey] || []).filter((sourceRecord) => String(sourceRecord?.name || "").trim());
  }

  function recordDisplayName(record) {
    if (!record) {
      return "";
    }
    return record.name_de && record.name_de !== record.name ? `${record.name_de} (${record.name})` : record.name;
  }

  function displayNameFor(moduleKey, value) {
    if (!value) {
      return "";
    }
    return recordDisplayName(getSourceRecords(moduleKey).find((sourceRecord) => sourceRecord.name === value)) || value;
  }

  function appendReferenceOptions(select, moduleKey, currentValue = "") {
    const optionValues = new Set();
    getSourceRecords(moduleKey).forEach((sourceRecord) => {
      optionValues.add(sourceRecord.name);
      const option = document.createElement("option");
      option.value = sourceRecord.name;
      option.textContent = recordDisplayName(sourceRecord);
      select.append(option);
    });

    if (currentValue && !optionValues.has(currentValue)) {
      const option = document.createElement("option");
      option.value = currentValue;
      option.textContent = currentValue;
      select.append(option);
    }
  }

  function createReferenceInput(fieldDefinition, record, recordIndex, title) {
    const select = document.createElement("select");
    const currentValue = record[fieldDefinition.key] || "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = fieldDefinition.placeholder || "Eintrag auswählen";
    select.append(placeholder);
    appendReferenceOptions(select, fieldDefinition.sourceModule, currentValue);

    select.value = currentValue;
    select.addEventListener("change", (event) => {
      store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value);
      if (fieldDefinition.key === "name") {
        title.textContent = event.target.value || "Unbenannter Eintrag";
      }
    });
    return select;
  }

  function createValidatorRuleInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "validator-rule-builder";
    const query = record[fieldDefinition.key] && typeof record[fieldDefinition.key] === "object" ? record[fieldDefinition.key] : {};
    const ruleText = document.createElement("p");
    ruleText.className = "rule-text-block";
    ruleText.textContent = buildValidatorRuleText(record, query);
    container.append(ruleText);

    if (record.operator !== "condition") {
      return container;
    }

    const clause = getFirstConditionClause(query);
    const requirement = getFirstRequirementReference(query);
    const controls = document.createElement("div");
    controls.className = "rule-builder-grid";

    const conditionClassification = createRuleSelect(
      "Wenn Klassifikation",
      "Klassifikation auswählen",
      clause.classification || "",
      (select) => appendReferenceOptions(select, "lx_classifications", clause.classification || ""),
    );
    const comparator = createRuleSelect("Vergleich", "Vergleich auswählen", clause.comparator || "eq", (select) => {
      VALIDATOR_COMPARATOR_OPTIONS.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel(optionValue);
        select.append(option);
      });
    });
    const valueInput = createRuleTextInput("Wert", getClauseValueText(clause));
    const requirementKind = createRuleSelect("Dann erforderlich", "Art auswählen", requirement.kind || "classification", (select) => {
      REQUIREMENT_KIND_OPTIONS.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionLabel(optionValue);
        select.append(option);
      });
    });
    const requirementSourceModule = REQUIREMENT_SOURCE_MODULES[requirementKind.input.value] || "lx_classifications";
    const requirementName = createRuleSelect(
      "Eintrag",
      "Eintrag auswählen",
      requirement.name || "",
      (select) => appendReferenceOptions(select, requirementSourceModule, requirement.name || ""),
    );

    controls.append(conditionClassification.wrapper, comparator.wrapper, valueInput.wrapper, requirementKind.wrapper, requirementName.wrapper);

    let requirementClassification = null;
    if (requirementKind.input.value === "unit") {
      requirementClassification = createRuleSelect(
        "Für Klassifikation",
        "Klassifikation auswählen",
        requirement.classification || record.classification || "",
        (select) => appendReferenceOptions(select, "lx_classifications", requirement.classification || record.classification || ""),
      );
      controls.append(requirementClassification.wrapper);
    }

    const writeQuery = () => {
      store.updateRecordField(
        activeModuleKey,
        recordIndex,
        fieldDefinition.key,
        buildConditionQuery({
          classification: conditionClassification.input.value,
          comparator: comparator.input.value,
          valueText: valueInput.input.value,
          requirementKind: requirementKind.input.value,
          requirementName: requirementName.input.value,
          requirementClassification: requirementClassification?.input.value || record.classification || "",
        }),
      );
    };

    [conditionClassification.input, comparator.input, requirementName.input].forEach((input) => {
      input.addEventListener("change", writeQuery);
    });
    requirementKind.input.addEventListener("change", () => {
      requirementName.input.value = "";
      writeQuery();
    });
    if (requirementClassification) {
      requirementClassification.input.addEventListener("change", writeQuery);
    }
    valueInput.input.addEventListener("change", writeQuery);

    container.append(controls);
    return container;
  }

  function createNumericDistributionParamsInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "validator-rule-builder";
    const params = getObjectFieldValue(record[fieldDefinition.key]);

    const ruleText = document.createElement("p");
    ruleText.className = "rule-text-block";
    ruleText.textContent = buildNumericDistributionText(record, params);
    container.append(ruleText);

    const controls = document.createElement("div");
    controls.className = "rule-builder-grid";
    const lowInput = createDescriptorNumberInput("Untergrenze", params.low ?? record.numeric_min ?? "", "0");
    const highInput = createDescriptorNumberInput("Obergrenze", params.high ?? record.numeric_max ?? "", "100");
    controls.append(lowInput.wrapper, highInput.wrapper);

    const writeParams = () => {
      const nextParams = { ...params };
      setOptionalNumber(nextParams, "low", lowInput.input.value);
      setOptionalNumber(nextParams, "high", highInput.input.value);
      store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, nextParams, { emit: false });
      ruleText.textContent = buildNumericDistributionText(record, nextParams);
      refreshDerivedViews();
    };

    lowInput.input.addEventListener("input", writeParams);
    highInput.input.addEventListener("input", writeParams);
    container.append(controls);
    return container;
  }

  function createSelectionDefaultOptionsInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "validator-rule-builder";
    const params = getObjectFieldValue(record[fieldDefinition.key]);
    const createdOptionValues = Array.isArray(record.selection_options) ? record.selection_options : [];
    const optionValues = mergeUniqueValues([...createdOptionValues, ...Object.keys(params)]);

    const ruleText = document.createElement("p");
    ruleText.className = "rule-text-block";
    ruleText.textContent = buildSelectionDefaultsText(optionValues, params);
    container.append(ruleText);

    const controls = document.createElement("div");
    controls.className = "rule-builder-grid";

    const optionSelect = createRuleSelect("Option aus diesem Paket", "Auswahloption einfügen", "", (select) => {
      mergeUniqueValues(createdOptionValues).forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        select.append(option);
      });
    });
    optionSelect.input.disabled = createdOptionValues.length === 0;

    const textControl = createRuleTextArea(
      "Standardgewichte",
      formatSelectionDefaultsText(optionValues, params),
      "adenoma = 1\nhyperplastic = 0.5",
    );
    controls.append(optionSelect.wrapper, textControl.wrapper);

    const writeDefaults = (textValue = textControl.input.value) => {
      const nextParams = parseSelectionDefaultsText(textValue);
      const nextOptionValues = mergeUniqueValues([...createdOptionValues, ...Object.keys(nextParams)]);
      store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, nextParams, { emit: false });
      ruleText.textContent = buildSelectionDefaultsText(nextOptionValues, nextParams);
      refreshDerivedViews();
    };

    optionSelect.input.addEventListener("change", () => {
      const selectedOption = optionSelect.input.value;
      if (!selectedOption) {
        return;
      }
      const currentLines = splitSelectionDefaultLines(textControl.input.value);
      const existingNames = new Set(currentLines.map((line) => parseSelectionDefaultLine(line)?.name).filter(Boolean));
      if (!existingNames.has(selectedOption)) {
        currentLines.push(`${selectedOption} = 1`);
        textControl.input.value = currentLines.join("\n");
        writeDefaults(textControl.input.value);
      }
      optionSelect.input.value = "";
    });
    textControl.input.addEventListener("input", () => writeDefaults());

    container.append(controls);
    return container;
  }

  function createDescriptorNumberInput(labelText, currentValue, placeholder) {
    const wrapper = document.createElement("label");
    wrapper.className = "rule-control";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.placeholder = placeholder;
    input.value = currentValue === undefined || currentValue === null ? "" : String(currentValue);
    wrapper.append(text, input);
    return { wrapper, input };
  }

  function createRuleTextArea(labelText, currentValue, placeholder) {
    const wrapper = document.createElement("label");
    wrapper.className = "rule-control";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("textarea");
    input.value = currentValue;
    input.placeholder = placeholder;
    input.rows = 4;
    wrapper.append(text, input);
    return { wrapper, input };
  }

  function getObjectFieldValue(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function mergeUniqueValues(values) {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function setOptionalNumber(target, key, value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      delete target[key];
      return;
    }
    const numericValue = parseDescriptorNumber(trimmed);
    if (numericValue !== null) {
      target[key] = numericValue;
    }
  }

  function parseDescriptorNumber(value) {
    const normalized = String(value ?? "").trim().replace(",", ".");
    const numericValue = Number(normalized);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function buildNumericDistributionText(record, params) {
    const distribution = optionLabel(record.numeric_distribution || "uniform");
    const lowText = params.low === undefined || params.low === "" ? "ohne feste Untergrenze" : `${params.low}`;
    const highText = params.high === undefined || params.high === "" ? "ohne feste Obergrenze" : `${params.high}`;
    return `Numerische Werte werden mit der Verteilung ${distribution} von ${lowText} bis ${highText} erwartet.`;
  }

  function buildSelectionDefaultsText(optionValues, params) {
    if (!optionValues.length) {
      return "Bitte zuerst Auswahloptionen eintragen. Danach können hier Standardgewichte gesetzt werden.";
    }
    const configured = optionValues
      .filter((optionValue) => params[optionValue] !== undefined && params[optionValue] !== "")
      .map((optionValue) => `${optionValue}: ${params[optionValue]}`);
    return configured.length
      ? `Standardgewichte: ${configured.join(", ")}.`
      : "Keine Standardgewichte gesetzt. Ohne Eingabe bleibt die Auswahl gleichwertig.";
  }

  function formatSelectionDefaultsText(optionValues, params) {
    return optionValues
      .filter((optionValue) => params[optionValue] !== undefined && params[optionValue] !== "")
      .map((optionValue) => `${optionValue} = ${params[optionValue]}`)
      .join("\n");
  }

  function parseSelectionDefaultsText(value) {
    const result = {};
    splitSelectionDefaultLines(value).forEach((line) => {
      const parsed = parseSelectionDefaultLine(line);
      if (parsed) {
        result[parsed.name] = parsed.weight;
      }
    });
    return result;
  }

  function splitSelectionDefaultLines(value) {
    return String(value || "")
      .split(/\r?\n|;/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function parseSelectionDefaultLine(line) {
    const match = line.match(/^(.+?)(?:\s*[=:]\s*|\s+)([-+]?\d+(?:[.,]\d+)?)$/);
    if (!match) {
      return null;
    }
    const name = match[1].trim();
    const weight = parseDescriptorNumber(match[2]);
    if (!name || weight === null) {
      return null;
    }
    return { name, weight };
  }

  function createRuleSelect(labelText, placeholderText, currentValue, appendOptions) {
    const wrapper = document.createElement("label");
    wrapper.className = "rule-control";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = placeholderText;
    input.append(placeholder);
    appendOptions(input);
    input.value = currentValue || "";
    wrapper.append(text, input);
    return { wrapper, input };
  }

  function createRuleTextInput(labelText, currentValue) {
    const wrapper = document.createElement("label");
    wrapper.className = "rule-control";
    const text = document.createElement("span");
    text.textContent = labelText;
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentValue;
    input.placeholder = "z.B. 10 oder klein, mittel, groß";
    wrapper.append(text, input);
    return { wrapper, input };
  }

  function getFirstConditionClause(query) {
    const condition = query?.condition && typeof query.condition === "object" ? query.condition : {};
    const clauses = Array.isArray(condition.any) && condition.any.length ? condition.any : condition.all || [];
    return clauses[0] && typeof clauses[0] === "object" ? clauses[0] : {};
  }

  function getFirstRequirementReference(query) {
    const condition = query?.condition && typeof query.condition === "object" ? query.condition : {};
    const requirements = Array.isArray(condition.then_requires) ? condition.then_requires : [];
    const requirement = requirements[0] && typeof requirements[0] === "object" ? requirements[0] : {};
    const legacyKind = REQUIREMENT_KIND_OPTIONS.find((kind) => requirement[kind]);
    return {
      kind: requirement.kind || legacyKind || "classification",
      name: requirement.name || (legacyKind ? requirement[legacyKind] : "") || "",
      classification: requirement.classification || "",
    };
  }

  function getClauseValueText(clause) {
    if (Array.isArray(clause.values)) {
      return clause.values.join(", ");
    }
    return clause.value === undefined || clause.value === null ? "" : String(clause.value);
  }

  function coerceRuleValue(value) {
    const trimmed = String(value || "").trim();
    if (trimmed === "") {
      return "";
    }
    const numericValue = Number(trimmed);
    return Number.isFinite(numericValue) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numericValue : trimmed;
  }

  function buildConditionQuery({
    classification,
    comparator,
    valueText,
    requirementKind,
    requirementName,
    requirementClassification,
  }) {
    const clause = {
      classification,
      comparator: comparator || "eq",
    };
    if (["in", "not_in"].includes(clause.comparator)) {
      clause.values = splitRuleValueList(valueText);
    } else {
      clause.value = coerceRuleValue(valueText);
    }

    const requirement = {
      kind: requirementKind || "classification",
      name: requirementName,
      required: true,
    };
    if (requirement.kind === "unit" && requirementClassification) {
      requirement.classification = requirementClassification;
    }

    return {
      condition: {
        any: [clause],
        then_requires: [requirement],
      },
    };
  }

  function splitRuleValueList(valueText) {
    return String(valueText || "")
      .split(",")
      .map((value) => coerceRuleValue(value))
      .filter((value) => value !== "");
  }

  function buildValidatorRuleText(record, query) {
    if (record.operator !== "condition") {
      return buildSimpleValidatorText(record);
    }

    const clause = getFirstConditionClause(query);
    const requirement = getFirstRequirementReference(query);
    const classification = displayNameFor("lx_classifications", clause.classification) || "[Klassifikation]";
    const comparator = optionLabel(clause.comparator || "eq");
    const value = getClauseValueText(clause) || "[Wert]";
    const requirementSourceModule = REQUIREMENT_SOURCE_MODULES[requirement.kind] || "lx_classifications";
    const requirementName = displayNameFor(requirementSourceModule, requirement.name) || "[Eintrag]";
    const requirementKind = optionLabel(requirement.kind || "classification");
    return `Wenn ${classification} ${comparator} ${value} ist, dann muss ${requirementKind} ${requirementName} angegeben werden.`;
  }

  function buildSimpleValidatorText(record) {
    const finding = displayNameFor("lx_findings", record.finding) || "[Befund]";
    const moduleModel = MODULE_MAP[activeModuleKey]?.model;
    const presencePhrase = (label) =>
      record.operator === "missing" ? `darf ${label} nicht angegeben sein` : `muss ${label} angegeben sein`;

    if (moduleModel === "classification_validator") {
      const classification = displayNameFor("lx_classifications", record.classification) || "[Klassifikation]";
      return `Beim Befund ${finding} ${presencePhrase(`die Klassifikation ${classification}`)}.`;
    }
    if (moduleModel === "intervention_validator") {
      const intervention = displayNameFor("lx_interventions", record.intervention) || "[Intervention]";
      return `Beim Befund ${finding} ${presencePhrase(`die Intervention ${intervention}`)}.`;
    }
    if (moduleModel === "unit_validator") {
      const classification = displayNameFor("lx_classifications", record.classification) || "[Klassifikation]";
      const unit = displayNameFor("lx_units", record.unit) || "[Einheit]";
      return `Beim Befund ${finding} ${presencePhrase(`die Einheit ${unit} für ${classification}`)}.`;
    }
    return `Der Befund ${finding} ${record.operator === "missing" ? "muss fehlen" : "muss vorhanden sein"}.`;
  }

  function createReferenceTagsInput(fieldDefinition, record, recordIndex) {
    const container = document.createElement("div");
    container.className = "reference-picker";
    const storedValues = Array.isArray(record[fieldDefinition.key]) ? record[fieldDefinition.key] : [];
    const allSourceRecords = (store.getState().records?.[fieldDefinition.sourceModule] || []).filter((sourceRecord) =>
      String(sourceRecord?.name || "").trim(),
    );
    const matchingSourceRecords = fieldDefinition.matchField
      ? allSourceRecords.filter((sourceRecord) => sourceRecord[fieldDefinition.matchField] === record.name)
      : allSourceRecords;
    const selectedValues = fieldDefinition.computed
      ? matchingSourceRecords.map((sourceRecord) => sourceRecord.name)
      : storedValues;
    const sourceRecords = fieldDefinition.computed
      ? matchingSourceRecords
      : matchingSourceRecords.filter(
          (sourceRecord) => !fieldDefinition.matchField || selectedValues.includes(sourceRecord.name) || sourceRecord[fieldDefinition.matchField] === record.name,
        );

    let select = null;
    if (!fieldDefinition.computed) {
      select = document.createElement("select");
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
    }

    const chipList = document.createElement("div");
    chipList.className = "reference-chip-list";
    if (!selectedValues.length) {
      const empty = document.createElement("p");
      empty.className = "reference-empty";
      empty.textContent = fieldDefinition.computed
        ? "Keine passenden Validatoren vorhanden."
        : sourceRecords.length
          ? "Noch keine Einträge ausgewählt."
          : "Bitte zuerst passende Einträge anlegen.";
      chipList.append(empty);
    }

    selectedValues.forEach((value) => {
      const sourceRecord = sourceRecords.find((candidate) => candidate.name === value);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `reference-chip${fieldDefinition.computed ? " readonly" : ""}`;
      chip.textContent =
        sourceRecord?.name_de && sourceRecord.name_de !== value
          ? `${sourceRecord.name_de}${fieldDefinition.computed ? ` (${value})` : " x"}`
          : `${value}${fieldDefinition.computed ? "" : " x"}`;
      if (!fieldDefinition.computed) {
        chip.title = `${value} entfernen`;
        chip.addEventListener("click", () => {
          store.updateRecordField(
            activeModuleKey,
            recordIndex,
            fieldDefinition.key,
            selectedValues.filter((selectedValue) => selectedValue !== value),
          );
        });
      }
      chipList.append(chip);
    });

    if (select) {
      container.append(select);
    }
    container.append(chipList);
    return container;
  }

  function renderPreview(state, previewGroups = buildPreviewGroups(state)) {
    const fileEntries = buildSerializedFiles(state);
    const filePaths = Object.keys(fileEntries);
    if (!filePaths.includes(activeFilePath)) {
      activeFilePath = "config.yaml";
    }

    fileTabs.innerHTML = "";

    fileTabs.append(
      createTreeGroup("files", "Dateien", "config.yaml, Modulkonfigurationen und data/*.yaml", buildFileTreeNodes(state), true),
      createTreeGroup(
        "hierarchy",
        "Konzept-Hierarchie",
        "Examination -> Finding / Intervention -> Classification -> ClassificationChoice -> ClassificationDescriptor -> Unit",
        buildConceptHierarchyNodes(state),
        true,
      ),
    );

    filePreview.textContent = activeFilePath ? fileEntries[activeFilePath] : "Keine Datei ausgewählt.";
  }

  function buildFileTreeNodes(state) {
    const nodes = [
      createTreeButton("config.yaml", "Basis", () => selectPreviewFile("config.yaml", "root"), {
        active: activeFilePath === "config.yaml",
      }),
    ];

    getPreviewModuleKeys(state).forEach((moduleKey) => {
      const moduleDefinition = MODULE_MAP[moduleKey];
      const documents = state.documents?.[moduleKey]?.length
        ? state.documents[moduleKey]
        : [{ id: `${moduleKey}-fallback`, name: "custom.yaml" }];
      const moduleChildren = [
        createTreeButton("config.yaml", "Modul", () => selectPreviewFile(`${moduleKey}/config.yaml`, moduleKey), {
          active: activeFilePath === `${moduleKey}/config.yaml`,
        }),
      ];

      documents.forEach((document) => {
        const documentPath = `${moduleKey}/data/${document.name}`;
        const recordNodes = (state.records?.[moduleKey] || [])
          .map((record, recordIndex) => ({ record, recordIndex }))
          .filter(({ record }) => record._documentId === document.id)
          .map(({ record, recordIndex }) =>
            createTreeButton(recordDisplayName(record) || record.name || "Unbenannter Eintrag", "Konzept", () => focusRecord(moduleKey, recordIndex), {
              compact: true,
            }),
          );

        moduleChildren.push(
          createTreeGroup(
            `${moduleKey}:${document.id}`,
            document.name,
            "data/*.yaml",
            [
              createTreeButton(document.name, documentPath, () => selectPreviewFile(documentPath, moduleKey, document.id), {
                active: activeFilePath === documentPath,
              }),
              ...recordNodes,
            ],
            activeFilePath === documentPath,
          ),
        );
      });

      nodes.push(
        createTreeGroup(
          moduleKey,
          moduleDefinition.label,
          CONCEPT_MODULE_TIER[moduleKey] || moduleDefinition.key,
          moduleChildren,
          activePreviewGroupKey === moduleKey,
        ),
      );
    });

    return nodes;
  }

  function getPreviewModuleKeys(state) {
    const selected = new Set(state.bundle.modules);
    return [
      ...CONCEPT_MODULE_ORDER.filter((moduleKey) => selected.has(moduleKey)),
      ...state.bundle.modules.filter((moduleKey) => !CONCEPT_MODULE_ORDER.includes(moduleKey)),
    ];
  }

  function createTreeGroup(nodeKey, label, meta, children, defaultOpen = false) {
    const details = document.createElement("details");
    details.className = "tree-group";
    details.open = expandedTreeNodes.has(nodeKey) || defaultOpen;
    details.addEventListener("toggle", () => {
      if (details.open) {
        expandedTreeNodes.add(nodeKey);
      } else {
        expandedTreeNodes.delete(nodeKey);
      }
    });

    const summary = document.createElement("summary");
    summary.className = "tree-summary";
    summary.innerHTML = "<span></span><small></small>";
    summary.querySelector("span").textContent = label;
    summary.querySelector("small").textContent = meta;
    details.append(summary, ...children);
    return details;
  }

  function createTreeButton(label, meta, onClick, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-button${options.active ? " active" : ""}${options.compact ? " compact" : ""}${options.missing ? " missing" : ""}`;
    button.disabled = options.disabled === true;
    button.innerHTML = "<span></span><small></small>";
    button.querySelector("span").textContent = label;
    button.querySelector("small").textContent = meta;
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  }

  function selectPreviewFile(path, moduleKey = "root", documentId = null) {
    activeFilePath = path;
    activePreviewGroupKey = moduleKey || "root";
    if (moduleKey && moduleKey !== "root") {
      expandedTreeNodes.add(moduleKey);
      if (!MODULE_MAP[moduleKey]?.hidden) {
        activeModuleKey = moduleKey;
      }
      if (documentId) {
        activeDocumentIds[moduleKey] = documentId;
      }
    }
    render(store.getState());
  }

  function buildConceptHierarchyNodes(state) {
    const examinationNodes = (state.records.lx_examinations || []).map((record, recordIndex) =>
      createConceptBranch(state, "lx_examinations", record, recordIndex, buildExaminationConceptChildren(state, record)),
    );

    if (examinationNodes.length) {
      return examinationNodes;
    }

    const fallbackNodes = [
      ...(state.records.lx_findings || []).map((record, recordIndex) =>
        createConceptBranch(state, "lx_findings", record, recordIndex, buildFindingConceptChildren(state, record)),
      ),
      ...(state.records.lx_interventions || []).map((record, recordIndex) =>
        createConceptBranch(state, "lx_interventions", record, recordIndex, buildInterventionConceptChildren(state, record)),
      ),
    ];

    return fallbackNodes.length
      ? fallbackNodes
      : [createTreeButton("Keine Konzepte", "Noch keine Untersuchungen oder Befunde vorhanden.", null, { disabled: true, missing: true })];
  }

  function createConceptBranch(state, moduleKey, record, recordIndex, children = []) {
    const wrapper = document.createElement("div");
    wrapper.className = "concept-branch";
    wrapper.append(
      createTreeButton(recordDisplayName(record) || record.name || "Unbenannter Eintrag", CONCEPT_MODULE_TIER[moduleKey] || MODULE_MAP[moduleKey]?.label || moduleKey, () =>
        focusRecord(moduleKey, recordIndex),
      ),
    );
    if (children.length) {
      const childList = document.createElement("div");
      childList.className = "tree-children";
      childList.append(...children);
      wrapper.append(childList);
    }
    return wrapper;
  }

  function createConceptReference(state, moduleKey, name, childrenBuilder) {
    const ref = findRecordReference(state, moduleKey, name);
    if (!ref) {
      return createTreeButton(name, `${CONCEPT_MODULE_TIER[moduleKey] || MODULE_MAP[moduleKey]?.label || moduleKey} fehlt`, null, {
        disabled: true,
        missing: true,
        compact: true,
      });
    }
    return createConceptBranch(state, moduleKey, ref.record, ref.recordIndex, childrenBuilder ? childrenBuilder(ref.record) : []);
  }

  function findRecordReference(state, moduleKey, name) {
    const recordIndex = (state.records?.[moduleKey] || []).findIndex((record) => record.name === name);
    if (recordIndex === -1) {
      return null;
    }
    return { record: state.records[moduleKey][recordIndex], recordIndex };
  }

  function buildExaminationConceptChildren(state, examination) {
    return [
      ...listRecordValues(examination, "findings").map((name) =>
        createConceptReference(state, "lx_findings", name, (record) => buildFindingConceptChildren(state, record)),
      ),
      ...listRecordValues(examination, "interventions").map((name) =>
        createConceptReference(state, "lx_interventions", name, (record) => buildInterventionConceptChildren(state, record)),
      ),
    ];
  }

  function buildFindingConceptChildren(state, finding) {
    return [
      ...listRecordValues(finding, "interventions").map((name) =>
        createConceptReference(state, "lx_interventions", name, (record) => buildInterventionConceptChildren(state, record)),
      ),
      ...listRecordValues(finding, "classifications").map((name) =>
        createConceptReference(state, "lx_classifications", name, (record) => buildClassificationConceptChildren(state, record)),
      ),
    ];
  }

  function buildInterventionConceptChildren(state, intervention) {
    return listRecordValues(intervention, "classifications").map((name) =>
      createConceptReference(state, "lx_classifications", name, (record) => buildClassificationConceptChildren(state, record)),
    );
  }

  function buildClassificationConceptChildren(state, classification) {
    return listRecordValues(classification, "classification_choices").map((name) =>
      createConceptReference(state, "lx_classification_choices", name, (record) => buildChoiceConceptChildren(state, record)),
    );
  }

  function buildChoiceConceptChildren(state, choice) {
    return listRecordValues(choice, "classification_choice_descriptors").map((name) =>
      createConceptReference(state, "lx_descriptors", name, (record) => buildDescriptorConceptChildren(state, record)),
    );
  }

  function buildDescriptorConceptChildren(state, descriptor) {
    return listRecordValues(descriptor, "unit").map((name) => createConceptReference(state, "lx_units", name));
  }

  function listRecordValues(record, key) {
    const value = record?.[key];
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }
    return value ? [value] : [];
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
