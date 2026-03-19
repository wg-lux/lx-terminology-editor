export async function runPublish(state) {
  const response = await fetch("/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "Publish-Aufruf fehlgeschlagen.");
    error.payload = payload;
    throw error;
  }

  return payload;
}
