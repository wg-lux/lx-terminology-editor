export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadTextEntries(entries, filenameTransform = (path) => path.replaceAll("/", "__")) {
  Object.entries(entries).forEach(([path, content]) => {
    downloadTextFile(filenameTransform(path), content, "text/yaml;charset=utf-8");
  });
}
