const DASHBOARD_STATE_SCHEMA_VERSION = '2026-03-25';

const LEGACY_LOCAL_STORAGE_PREFIXES = [
  'mold-trial-stages:',
  'mold-trial-evidence:',
  'dashboard_fai_parser_state_v2:',
  'surface-parser-v2:',
];

const SCOPED_LOCAL_STORAGE_PREFIXES = [
  'mold-trial-stages:',
  'mold-trial-evidence:',
  'dashboard_fai_parser_state:',
  'surface-parser:',
];

const DASHBOARD_SESSION_KEYS = [
  'dashboard_active_module',
  'dashboard_scroll_y',
  'dashboard_filter',
  'dashboard_current_filter',
];

export const DASHBOARD_EVIDENCE_DB_NAME = `dashboard-cache:${DASHBOARD_STATE_SCHEMA_VERSION}`;

function normalizeKeyPart(part: string): string {
  const trimmed = part.trim();
  return trimmed ? trimmed : 'default';
}

export function buildDashboardScopedStorageKey(baseKey: string, ...parts: string[]): string {
  const normalizedBaseKey = normalizeKeyPart(baseKey);
  const normalizedParts = parts.map((part) => normalizeKeyPart(part)).join(':');
  return `${normalizedBaseKey}:${DASHBOARD_STATE_SCHEMA_VERSION}:${normalizedParts}`;
}

function shouldRemoveLocalStorageKey(key: string): boolean {
  if (LEGACY_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return true;
  }

  return SCOPED_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function deleteIndexedDbDatabase(name: string): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}

export async function clearDashboardClientState(): Promise<{
  removedLocalStorageKeys: number;
  removedSessionStorageKeys: number;
  deletedIndexedDbs: string[];
}> {
  if (typeof window === 'undefined') {
    return {
      removedLocalStorageKeys: 0,
      removedSessionStorageKeys: 0,
      deletedIndexedDbs: [],
    };
  }

  let removedLocalStorageKeys = 0;
  const localStorageKeys = Object.keys(window.localStorage);
  for (const key of localStorageKeys) {
    if (!shouldRemoveLocalStorageKey(key)) continue;
    window.localStorage.removeItem(key);
    removedLocalStorageKeys += 1;
  }

  let removedSessionStorageKeys = 0;
  for (const key of DASHBOARD_SESSION_KEYS) {
    if (window.sessionStorage.getItem(key) === null) continue;
    window.sessionStorage.removeItem(key);
    removedSessionStorageKeys += 1;
  }

  const dbNames = ['dashboard-cache', DASHBOARD_EVIDENCE_DB_NAME];
  const deleteResults = await Promise.all(
    dbNames.map(async (dbName) => ((await deleteIndexedDbDatabase(dbName)) ? dbName : null)),
  );
  const deletedIndexedDbs = deleteResults.filter((name): name is string => Boolean(name));

  return {
    removedLocalStorageKeys,
    removedSessionStorageKeys,
    deletedIndexedDbs,
  };
}
