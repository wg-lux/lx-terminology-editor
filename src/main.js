import { createDefaultState } from "./models/state-factory.js";
import { normalizeState } from "./models/validator.js";
import { createStore } from "./store.js";
import { mountApp } from "./ui/app-ui.js";
import { loadPersistedState, savePersistedState } from "./utils/persistence.js";
import { readSharedState } from "./utils/url-hash.js";

const STORAGE_KEY = "lx-terminology-editor-state";

const initialState = normalizeState(readSharedState() || loadPersistedState(STORAGE_KEY) || createDefaultState());
const store = createStore(initialState);
window.__lxTerminologyStore = store;

store.subscribe((state) => {
  savePersistedState(STORAGE_KEY, state);
});

mountApp({ store });
