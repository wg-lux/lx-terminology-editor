import { buildFileObjects, buildPreviewGroups } from "../models/config-loader.js";
import { MODULE_MAP } from "../models/module-definitions.js";
import { validateBundle } from "../models/validator.js";
import { downloadTextEntries } from "../utils/download.js";
import { runLint } from "../utils/lint-api.js";
import { runPublish } from "../utils/publish-api.js";
import { downloadBundleZip, importBundleZip } from "../utils/zip-bundle.js";
import { buildShareUrl } from "../utils/url-hash.js";
import { stringifyYaml } from "../utils/yaml-helper.js";

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
  const zipImportButton = document.querySelector("#zip-import-button");
  const zipImportInput = document.querySelector("#zip-import-input");
  const lintButtons = document.querySelectorAll('[data-action="lint"]');
  const publishButtons = document.querySelectorAll('[data-action="publish"]');
  const resetButton = document.querySelector("#reset-button");
  const cardTemplate = document.querySelector("#record-card-template");
  const lintStatus = document.querySelector("#lint-status");
  const lintOutput = document.querySelector("#lint-output");
  const publishStatus = document.querySelector("#publish-status");
  const publishOutput = document.querySelector("#publish-output");

  let activeModuleKey = store.getState().bundle.modules[0] || "lx_examinations";
  let activePreviewGroupKey = "root";
  let activeFilePath = "config.yaml";
  const activeDocumentIds = {};
  let lintState = {
    status: "idle",
    summary: "Noch nicht ausgeführt.",
    output: "Noch keine Lint-Ausgabe.",
  };
  let publishState = {
    status: "idle",
    summary: "Noch nicht veröffentlicht.",
    output: "Noch keine Publish-Ausgabe.",
  };

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
      const bundleName = (state.bundle.name || "terminology-bundle").trim() || "terminology-bundle";
      await downloadBundleZip(buildSerializedFiles(state), `${bundleName}.zip`);
      showToast("ZIP-Datei heruntergeladen.");
    } catch (error) {
      console.error(error);
      showToast("ZIP-Download fehlgeschlagen.");
    }
  });

  zipImportButton.addEventListener("click", () => {
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
      store.replaceState(importedState);
      const nextState = store.getState();
      activeModuleKey = nextState.bundle.modules[0] || "lx_examinations";
      activePreviewGroupKey = "root";
      activeFilePath = "config.yaml";
      showToast("ZIP-Bundle importiert.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "ZIP-Import fehlgeschlagen.");
    }
  });

  lintButtons.forEach((lintButton) => {
    lintButton.addEventListener("click", async () => {
      lintState = {
        status: "running",
        summary: "Lint läuft...",
        output: "Führe ok gegen das aktuelle Bundle aus...",
      };
      render(store.getState());

      try {
        const result = await runLint(store.getState());
        lintState = {
          status: result.ok ? "ok" : "error",
          summary: result.summary_text,
          output: result.output || "Keine Ausgabe.",
        };
        showToast(result.ok ? "Lint erfolgreich." : "Lint mit Fehlern beendet.");
      } catch (error) {
        lintState = {
          status: "error",
          summary: "Lint-Aufruf fehlgeschlagen.",
          output: error.payload?.output || error.message || "Unbekannter Fehler.",
        };
        showToast("Lint-Aufruf fehlgeschlagen.");
      }

      render(store.getState());
    });
  });

  publishButtons.forEach((publishButton) => {
    publishButton.addEventListener("click", async () => {
      publishState = {
        status: "running",
        summary: "Publish läuft...",
        output: "Schreibe Bundle und aktualisiere KB-Registry...",
      };
      render(store.getState());

      try {
        const result = await runPublish(store.getState());
        publishState = {
          status: result.ok ? "ok" : "error",
          summary: result.summary_text,
          output: result.output || "Keine Ausgabe.",
        };
        showToast(result.ok ? "Publish erfolgreich." : "Publish mit Fehlern beendet.");
      } catch (error) {
        publishState = {
          status: "error",
          summary: "Publish-Aufruf fehlgeschlagen.",
          output: error.payload?.output || error.message || "Unbekannter Fehler.",
        };
        showToast("Publish-Aufruf fehlgeschlagen.");
      }

      render(store.getState());
    });
  });

  resetButton.addEventListener("click", () => {
    store.reset();
    activeModuleKey = store.getState().bundle.modules[0] || "lx_examinations";
    activeFilePath = "config.yaml";
    showToast("Beispiel-Bundle wiederhergestellt.");
  });

  store.subscribe(render);
  render(store.getState());

  function refreshDerivedViews() {
    const state = store.getState();
    renderPreview(state);
    renderLintPanel();
    renderPublishPanel();
  }

  function render(state) {
    try {
      const validation = validateBundle(state);
      const previewGroups = buildPreviewGroups(state);

      if (!state.bundle.modules.includes(activeModuleKey)) {
        activeModuleKey = state.bundle.modules[0] || "lx_examinations";
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
      renderPublishPanel();
    } catch (error) {
      console.error("UI render failed", error);
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
      { key: "name", label: "Bundle-Name", type: "text", hint: "Wird in das Feld `name` der root config.yaml geschrieben." },
      { key: "version", label: "Version", type: "text", hint: "Semantische Version empfohlen." },
      { key: "publish.name", label: "Publish-Name", type: "text", hint: "Lokaler Zielname unter `.published/`." },
      { key: "description", label: "Beschreibung", type: "textarea", hint: "Optionale Paketbeschreibung.", full: true },
    ];

    bundleForm.innerHTML = "";

    fields.forEach((fieldDefinition) => {
      const wrapper = document.createElement("div");
      wrapper.className = `field${fieldDefinition.full ? " field-full" : ""}`;

      const label = document.createElement("label");
      label.textContent = fieldDefinition.label;

      const input =
        fieldDefinition.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      if (fieldDefinition.type !== "textarea") {
        input.type = fieldDefinition.type;
      }
      input.value =
        fieldDefinition.key === "publish.name"
          ? state.publish?.name || ""
          : state.bundle[fieldDefinition.key] || "";
      input.addEventListener("input", (event) => {
        if (fieldDefinition.key === "publish.name") {
          store.setPublishField("name", event.target.value, { emit: false });
        } else {
          store.setBundleField(fieldDefinition.key, event.target.value, { emit: false });
        }
        refreshDerivedViews();
      });

      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent =
        fieldDefinition.key === "name" && validation.bundleErrors.length
          ? validation.bundleErrors.join(" ")
          : fieldDefinition.hint;

      wrapper.append(label, input, hint);
      bundleForm.append(wrapper);
    });
  }

  function renderModulePickers(state) {
    modulePickers.innerHTML = "";

    Object.values(MODULE_MAP).forEach((moduleDefinition) => {
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

    if (!state.bundle.modules.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Wähle mindestens ein Modul aus, um Datensätze zu bearbeiten.";
      moduleTabs.append(empty);
      return;
    }

    state.bundle.modules.forEach((moduleKey) => {
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

    if (!state.bundle.modules.length) {
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
    addButton.textContent = `${moduleDefinition.model} hinzufügen`;
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
      empty.textContent = `Noch keine ${moduleDefinition.label.toLowerCase()} in dieser Datei. Füge den ersten ${moduleDefinition.model}-Eintrag hinzu.`;
      stack.append(empty);
    }

    visibleRecords.forEach(({ record, actualIndex }, recordIndex) => {
      const fragment = cardTemplate.content.cloneNode(true);
      const title = fragment.querySelector("h3");
      const kicker = fragment.querySelector(".record-kicker");
      const fields = fragment.querySelector(".record-fields");
      const recordErrors = validation.moduleErrors[activeModuleKey]?.[actualIndex] || [];

      kicker.textContent = `${moduleDefinition.model} ${recordIndex + 1}${recordErrors.length ? ` • ${recordErrors.length} Fehler` : ""}`;
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
    wrapper.className = `field${fieldDefinition.type === "textarea" || fieldDefinition.type === "tags" ? " field-full" : ""}`;

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
    } else if (fieldDefinition.type === "json") {
      input = document.createElement("textarea");
      input.value = Object.keys(record[fieldDefinition.key] || {}).length
        ? JSON.stringify(record[fieldDefinition.key], null, 2)
        : "";
      input.placeholder = fieldDefinition.placeholder || "";
      input.addEventListener("input", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value, { emit: false });
        refreshDerivedViews();
      });
    } else if (fieldDefinition.type === "select") {
      input = document.createElement("select");
      fieldDefinition.options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        input.append(option);
      });
      input.value = record[fieldDefinition.key] || fieldDefinition.options[0];
      input.addEventListener("change", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value);
      });
    } else if (fieldDefinition.type === "boolean") {
      input = document.createElement("select");
      [
        { value: "false", label: "false" },
        { value: "true", label: "true" },
      ].forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue.value;
        option.textContent = optionValue.label;
        input.append(option);
      });
      input.value = record[fieldDefinition.key] ? "true" : "false";
      input.addEventListener("change", (event) => {
        store.updateRecordField(activeModuleKey, recordIndex, fieldDefinition.key, event.target.value);
      });
    } else {
      input = document.createElement("input");
      input.type = fieldDefinition.type === "number" ? "number" : "text";
      input.placeholder = fieldDefinition.placeholder || "";
      input.value = fieldDefinition.type === "tags" ? (record[fieldDefinition.key] || []).join(", ") : record[fieldDefinition.key] || "";
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
    hint.textContent =
      recordErrors.find((error) => error.startsWith(fieldDefinition.label)) ||
      (fieldDefinition.type === "tags"
        ? "Werte durch Kommas trennen."
        : fieldDefinition.type === "json"
          ? "JSON-Objekt, z.B. {\"low\": 0, \"high\": 100}."
        : "Optional, sofern der nachgelagerte Validator das Feld nicht verlangt.");

    wrapper.append(input, hint);
    return wrapper;
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
    lintStatus.textContent = lintState.summary;
    lintOutput.textContent = lintState.output;
    lintButtons.forEach((lintButton) => {
      lintButton.disabled = lintState.status === "running";
    });
  }

  function renderPublishPanel() {
    publishStatus.textContent = publishState.summary;
    publishOutput.textContent = publishState.output;
    publishButtons.forEach((publishButton) => {
      publishButton.disabled = publishState.status === "running";
    });
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
