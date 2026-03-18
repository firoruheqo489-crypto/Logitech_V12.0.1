const API_KEY_STORAGE_KEY = 'dashboard_api_key';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';
}

export function promptForApiKey(): 'saved' | 'cleared' | 'cancelled' {
  if (typeof window === 'undefined') return 'cancelled';

  const input = window.prompt('输入本地写入授权 key，留空则清除：', getStoredApiKey());
  if (input === null) return 'cancelled';

  const next = input.trim();
  if (!next) {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return 'cleared';
  }

  window.localStorage.setItem(API_KEY_STORAGE_KEY, next);
  return 'saved';
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const method = (init?.method || 'GET').toUpperCase();
  const apiKey = getStoredApiKey();

  if (method !== 'GET' && method !== 'HEAD' && apiKey) {
    headers.set('x-api-key', apiKey);
  }

  return fetch(url, { ...init, headers });
}
