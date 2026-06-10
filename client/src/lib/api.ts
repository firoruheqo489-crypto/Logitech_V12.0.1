import { toast } from 'sonner';

const API_KEY_STORAGE_KEY = 'dashboard_api_key';
const WRITE_SESSION_ENDPOINT = '/api/auth/write-session';

export const DEFAULT_LOCAL_WRITE_PASSWORD = '476281307';

let pendingWriteAuthorization: Promise<boolean> | null = null;

async function showCyberPromptDialog(options: {
  title: string;
  subtitle?: string;
  description?: string;
  fields: Array<{
    kind: 'text' | 'password' | 'number' | 'date' | 'select';
    name: string;
    label: string;
    defaultValue?: string;
    placeholder?: string;
    required?: boolean;
    maxLength?: number;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: string; label: string }[];
  }>;
  confirmText?: string;
  cancelText?: string;
  tone?: 'cyan' | 'purple';
}): Promise<Record<string, string> | null> {
  try {
    const promptModule = await import('@/components/ui/showCyberPromptDialog');
    return promptModule.showCyberPromptDialog(options as any);
  } catch (error) {
    console.error('Failed to load cyber prompt dialog:', error);
    const passwordField = options.fields.find((field) => field.kind === 'password');
    const fallbackLabel = passwordField?.label || '请输入管理员写入密码';
    const fallbackValue = window.prompt(fallbackLabel);
    if (!fallbackValue || !passwordField?.name) {
      return null;
    }
    return { [passwordField.name]: fallbackValue };
  }
}

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

  const values = await showCyberPromptDialog({
    title: '写入授权',
    subtitle: '管理员安全校验',
    description: '请输入管理员写入密码。授权成功后，本机会自动保存安全会话；取消则维持只读模式。',
    fields: [
      {
        kind: 'password',
        name: 'apiKey',
        label: '管理员密码',
        placeholder: '请输入管理员密码',
        required: true,
        maxLength: 128,
      },
    ],
    confirmText: '确认授权',
    cancelText: '取消',
    tone: 'purple',
  });
  if (!values) return false;

  const apiKey = (values.apiKey ?? '').trim();
  if (!apiKey) return false;

  const authenticated = await loginWriteSession(apiKey);
  if (!authenticated) {
    toast.error('管理员写入密码无效，请确认后重试。');
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

async function hasWriteSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const response = await fetch(WRITE_SESSION_ENDPOINT, {
    credentials: 'same-origin',
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return false;

  const payload = (await response.json().catch(() => null)) as { authenticated?: unknown } | null;
  return Boolean(payload?.authenticated);
}

export async function ensureWriteAuthorization(): Promise<boolean> {
  if (await hasWriteSession()) {
    forgetStoredApiKey();
    return true;
  }

  return requestWriteAuthorizationOnce();
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

export async function promptForApiKey(): Promise<AuthPromptResult> {
  if (typeof window === 'undefined') return 'cancelled';

  // Compatibility shim: any stale callers should enter the current write-session flow
  // instead of persisting a legacy x-api-key that causes repeated auth failures.
  forgetStoredApiKey();
  const authenticated = await requestWriteAuthorizationOnce();
  return authenticated ? 'saved' : 'cancelled';
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
