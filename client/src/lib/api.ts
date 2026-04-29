const API_KEY_STORAGE_KEY = 'dashboard_api_key';
const WRITE_SESSION_ENDPOINT = '/api/auth/write-session';

export const DEFAULT_LOCAL_WRITE_PASSWORD = '476281307';

let pendingWriteAuthorization: Promise<boolean> | null = null;

type AuthPromptResult = 'saved' | 'cleared' | 'cancelled';

function isWriteMethod(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function readAuthErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '';
  }

  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

async function isWriteAuthFailure(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  const payload = await response.clone().json().catch(() => null);
  return readAuthErrorCode(payload) === 'API_KEY_INVALID';
}

function forgetStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(API_KEY_STORAGE_KEY);
}

function buildRequestInit(init: RequestInit | undefined, method: string): RequestInit {
  const headers = new Headers(init?.headers);
  const apiKey = getStoredApiKey();

  if (isWriteMethod(method) && apiKey) {
    headers.set('x-api-key', apiKey);
  }

  return {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
    headers,
  };
}

async function loginWriteSession(apiKey: string): Promise<boolean> {
  const response = await fetch(WRITE_SESSION_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey }),
  });

  if (!response.ok) {
    return false;
  }

  forgetStoredApiKey();
  return true;
}

async function requestWriteAuthorization(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const input = window.prompt('请输入管理员写入密码，授权后本机将自动保存安全会话：', '');
  if (input === null) return false;

  const apiKey = input.trim();
  if (!apiKey) return false;

  const authenticated = await loginWriteSession(apiKey);
  if (!authenticated) {
    window.alert('管理员写入密码无效，请确认后重试。');
  }

  return authenticated;
}

async function requestWriteAuthorizationOnce(): Promise<boolean> {
  if (!pendingWriteAuthorization) {
    pendingWriteAuthorization = requestWriteAuthorization().finally(() => {
      pendingWriteAuthorization = null;
    });
  }

  return pendingWriteAuthorization;
}

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || '';
}

export function setStoredApiKey(value: string): void {
  if (typeof window === 'undefined') return;
  const next = value.trim();
  if (!next) {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(API_KEY_STORAGE_KEY, next);
}

export function promptForApiKey(): AuthPromptResult {
  if (typeof window === 'undefined') return 'cancelled';

  const input = window.prompt('请输入旧版写入授权 key，留空可清除当前授权：', getStoredApiKey());
  if (input === null) return 'cancelled';

  const next = input.trim();
  if (!next) {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return 'cleared';
  }

  window.localStorage.setItem(API_KEY_STORAGE_KEY, next);
  return 'saved';
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const response = await fetch(url, buildRequestInit(init, method));

  if (!isWriteMethod(method) || !(await isWriteAuthFailure(response))) {
    return response;
  }

  const authenticated = await requestWriteAuthorizationOnce();
  if (!authenticated) {
    return response;
  }

  return fetch(url, buildRequestInit(init, method));
}
