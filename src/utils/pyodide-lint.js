const PYODIDE_VERSION = "0.29.3";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

let pyodideRuntimePromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", resolve, { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      if (globalThis.loadPyodide) {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Pyodide konnte nicht geladen werden.")), { once: true });
    document.head.append(script);
  });
}

async function loadAdapterSource() {
  const adapterUrl = new URL("../py/browser_kb_yaml_lint.py", import.meta.url);
  const response = await fetch(adapterUrl);
  if (!response.ok) {
    throw new Error("Python-Prüflogik konnte nicht geladen werden.");
  }
  return response.text();
}

async function getPyodideRuntime() {
  if (!pyodideRuntimePromise) {
    pyodideRuntimePromise = (async () => {
      await loadScript(PYODIDE_SCRIPT_URL);
      const pyodide = await globalThis.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      await pyodide.loadPackage("pyyaml");
      const adapterSource = await loadAdapterSource();
      pyodide.FS.writeFile("/browser_kb_yaml_lint.py", adapterSource);
      await pyodide.runPythonAsync(`
import sys
if "/" not in sys.path:
    sys.path.insert(0, "/")
import browser_kb_yaml_lint
`);
      return pyodide;
    })();
  }
  try {
    return await pyodideRuntimePromise;
  } catch (error) {
    pyodideRuntimePromise = null;
    throw error;
  }
}

export async function runPyodideLint(fileMap) {
  const pyodide = await getPyodideRuntime();
  pyodide.globals.set("LINT_FILE_MAP_JSON", JSON.stringify(fileMap));
  try {
    const resultJson = await pyodide.runPythonAsync(`
import browser_kb_yaml_lint
browser_kb_yaml_lint.lint_file_map_json(LINT_FILE_MAP_JSON)
`);
    return JSON.parse(resultJson);
  } finally {
    pyodide.globals.delete("LINT_FILE_MAP_JSON");
  }
}
