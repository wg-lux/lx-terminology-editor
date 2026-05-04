import { parse } from "../vendor/yaml/index.js";
import { MODULE_MAP } from "../models/module-definitions.js";
import { normalizeDocumentName } from "../models/validator.js";

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
          ...record,
          _documentId: documentId,
        });
      });
    });
  });

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
