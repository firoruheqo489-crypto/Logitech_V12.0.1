const DB_NAME = 'dashboard-cache';
const STORE_NAME = 'mold-trial-evidence';
const DB_VERSION = 1;
const FALLBACK_STORAGE_PREFIX = 'dashboard-cache:fallback:';

function openEvidenceDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function getFallbackStorageKey(key: string): string {
  return `${FALLBACK_STORAGE_PREFIX}${key}`;
}

export async function loadMoldTrialEvidence<T>(key: string): Promise<T | null> {
  const db = await openEvidenceDb();
  if (db) {
    try {
      return await new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error('Failed to read IndexedDB evidence'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error('Failed to finish IndexedDB read'));
      });
    } catch {
      db.close();
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(getFallbackStorageKey(key));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  return null;
}

export async function saveMoldTrialEvidence<T>(key: string, value: T): Promise<void> {
  const db = await openEvidenceDb();
  let indexedDbSucceeded = false;

  if (db) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);

        tx.oncomplete = () => {
          indexedDbSucceeded = true;
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('Failed to write IndexedDB evidence'));
      });
    } catch {
      db.close();
    }
  }

  if (!indexedDbSucceeded && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getFallbackStorageKey(key), JSON.stringify(value));
    } catch {
      // Ignore fallback write failures and let the caller keep going.
    }
  }
}
