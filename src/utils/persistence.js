export function loadPersistedState(storageKey) {
  try {
    const rawState = window.localStorage.getItem(storageKey);
    return rawState ? JSON.parse(rawState) : null;
  } catch (error) {
    console.error("Failed to load local state.", error);
    return null;
  }
}

export function savePersistedState(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to save local state.", error);
  }
}
