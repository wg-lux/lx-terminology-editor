import { MODULE_MAP } from "./module-definitions.js";
import { RECORD_PASSTHROUGH_KEY, pruneEmpty } from "./validator.js";

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

  state.bundle.modules.forEach((moduleKey) => {
    const moduleDefinition = MODULE_MAP[moduleKey];
    fileObjects[`${moduleKey}/config.yaml`] = buildModuleConfig(moduleDefinition);
    const documents = state.documents?.[moduleKey]?.length
      ? state.documents[moduleKey]
      : [{ id: `${moduleKey}-fallback`, name: "custom.yaml" }];
    documents.forEach((document) => {
      fileObjects[`${moduleKey}/data/${document.name}`] = state.records[moduleKey]
        .filter((record) => record._documentId === document.id)
        .map((record) => {
          const passthrough =
            record[RECORD_PASSTHROUGH_KEY] && typeof record[RECORD_PASSTHROUGH_KEY] === "object"
              ? record[RECORD_PASSTHROUGH_KEY]
              : {};

          return pruneEmpty({
            model: moduleDefinition.model,
            ...record,
            ...passthrough,
            _documentId: undefined,
            [RECORD_PASSTHROUGH_KEY]: undefined,
          });
        });
    });
  });

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
