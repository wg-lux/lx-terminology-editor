export async function runLint(state) {
  const response = await fetch("/api/lint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "Lint-Aufruf fehlgeschlagen.");
    error.payload = payload;
    throw error;
  }

  return payload;
}
