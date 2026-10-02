/** Minimal IndexedDB key-value store. Resolves to null/no-op when IndexedDB is unavailable (tests, private mode). */
const DB = "atlas-demo";
const STORE = "kv";

const open = () =>
  new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

let dbPromise: Promise<IDBDatabase | null> | null = null;
const db = () => (dbPromise ??= open());

export const idbGet = async <T,>(key: string): Promise<T | null> => {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    const req = d.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
};

export const idbSet = async (key: string, value: unknown): Promise<void> => {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};

export const idbDelete = async (key: string): Promise<void> => {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
};
