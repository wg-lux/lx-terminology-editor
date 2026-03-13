function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function formatScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const stringValue = String(value);
  if (stringValue === "") {
    return '""';
  }

  if (/^[A-Za-z0-9_./-]+$/.test(stringValue)) {
    return stringValue;
  }

  return JSON.stringify(stringValue);
}

function formatObjectValue(value, depth) {
  if (isScalar(value)) {
    return ` ${formatScalar(value)}`;
  }

  return `\n${stringifyYaml(value, depth + 1).trimEnd()}`;
}

export function stringifyYaml(value, depth = 0) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return "[]\n";
    }

    return value
      .map((item) => {
        const indent = "  ".repeat(depth);

        if (isScalar(item)) {
          return `${indent}- ${formatScalar(item)}`;
        }

        if (Array.isArray(item)) {
          return `${indent}-\n${stringifyYaml(item, depth + 1).trimEnd()}`;
        }

        const entries = Object.entries(item);
        if (!entries.length) {
          return `${indent}- {}`;
        }

        const [firstKey, firstValue] = entries[0];
        let block = `${indent}- ${firstKey}:${formatObjectValue(firstValue, depth)}`;
        entries.slice(1).forEach(([key, entry]) => {
          block += `\n${indent}  ${key}:${formatObjectValue(entry, depth + 1)}`;
        });
        return block;
      })
      .join("\n")
      .concat("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) {
      return "{}\n";
    }

    return entries
      .map(([key, entry]) => `${"  ".repeat(depth)}${key}:${formatObjectValue(entry, depth)}`)
      .join("\n")
      .concat("\n");
  }

  return `${formatScalar(value)}\n`;
}
