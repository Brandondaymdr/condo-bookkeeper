/**
 * IndexedDB persistence layer.
 *
 * Stores the entire app state as a single JSON blob in IndexedDB.
 * Provides save/load with auto-save support.
 */

import { createDefaultStore } from "../models/schema.js";
import { DEFAULT_RULES } from "../models/defaultRules.js";

const DB_NAME = "condo-bookkeeper";
const DB_VERSION = 1;
const STORE_NAME = "app-data";
const DATA_KEY = "store";

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load the full app store from IndexedDB.
 * Returns the default store (with pre-loaded rules) if nothing saved yet.
 *
 * @returns {Promise<Object>} The app store
 */
export async function loadStore() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(DATA_KEY);

      request.onsuccess = () => {
        if (request.result) {
          // Merge with defaults to handle schema upgrades
          const saved = request.result;
          const defaults = createDefaultStore();
          const merged = {
            ...defaults,
            ...saved,
            // Ensure arrays exist
            transactions: saved.transactions || [],
            rules: saved.rules || [],
            learned_patterns: saved.learned_patterns || [],
            journal_entries: saved.journal_entries || [],
            import_batches: saved.import_batches || [],
            balance_sheet_openings: {
              ...defaults.balance_sheet_openings,
              ...(saved.balance_sheet_openings || {}),
            },
            settings: {
              ...defaults.settings,
              ...(saved.settings || {}),
            },
          };
          resolve(merged);
        } else {
          // First launch — create default store with pre-loaded rules
          const defaultStore = createDefaultStore();
          defaultStore.rules = DEFAULT_RULES.map(r => ({ ...r }));
          resolve(defaultStore);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("IndexedDB load failed, using defaults:", err);
    const defaultStore = createDefaultStore();
    defaultStore.rules = DEFAULT_RULES.map(r => ({ ...r }));
    return defaultStore;
  }
}

/**
 * Save the full app store to IndexedDB.
 *
 * @param {Object} data - The complete app store
 * @returns {Promise<void>}
 */
export async function saveStore(data) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, DATA_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB save failed:", err);
    throw err;
  }
}

/**
 * Clear all data from IndexedDB. Used for full reset.
 *
 * @returns {Promise<void>}
 */
export async function clearStore() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("IndexedDB clear failed:", err);
    throw err;
  }
}
