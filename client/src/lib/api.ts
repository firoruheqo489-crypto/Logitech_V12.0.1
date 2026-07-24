import { toast } from "sonner";
import { notifyDashboardAccessRequired } from "./dashboardAccess";

const API_KEY_STORAGE_KEY = "dashboard_api_key";
const WRITE_SESSION_ENDPOINT = "/api/auth/write-session";
export const WRITE_SESSION_CHANGED_EVENT = "dashboard-write-session-changed";

export type WriteSessionStatus = {
  authenticated: boolean;
  configured: boolean;
};

let pendingWriteAuthorization: Promise<boolean> | null = null;

async function showCyberPromptDialog(options: {
  title: string;
  subtitle?: string;
  description?: string;
  fields: Array<{
    kind: "text" | "password" | "number" | "date" | "select";
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
  tone?: "cyan" | "purple";
}): Promise<Record<string, string> | null> {
  try {
    const promptModule = await import("@/components/ui/showCyberPromptDialog");
    return promptModule.showCyberPromptDialog(options as any);
  } catch (error) {
    console.error("Failed to load cyber prompt dialog:", error);
    const passwordField = options.fields.find(
      field => field.kind === "password"
    );
    const fallbackLabel = passwordField?.label || "请输入管理员写入密码";
    const fallbackValue = window.prompt(fallbackLabel);
    if (!fallbackValue || !passwordField?.name) {
      return null;
    }
    return { [passwordField.name]: fallbackValue };
  }
}

type AuthPromptResult = "saved" | "cleared" | "cancelled";

function isWriteMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function readAuthErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function isWriteAuthFailure(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }

  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  return readAuthErrorCode(payload) === "API_KEY_INVALID";
}

async function isDashboardAccessFailure(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;
  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  return readAuthErrorCode(payload) === "DASHBOARD_ACCESS_REQUIRED";
}

function forgetStoredApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(API_KEY_STORAGE_KEY);
}

function buildRequestInit(
  init: RequestInit | undefined,
  method: string
): RequestInit {
  const headers = new Headers(init?.headers);

  return {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  };
}

function notifyWriteSessionChanged(status: WriteSessionStatus): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WRITE_SESSION_CHANGED_EVENT, { detail: status })
  );
}

async function loginWriteSession(password: string): Promise<boolean> {
  const response = await fetch(WRITE_SESSION_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    return false;
  }

  forgetStoredApiKey();
  notifyWriteSessionChanged({ authenticated: true, configured: true });
  return true;
}

async function requestWriteAuthorization(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const values = await showCyberPromptDialog({
    title: "写入授权",
    subtitle: "管理员安全校验",
    description:
      "请输入管理员写入密码。授权成功后，本机会自动保存安全会话；取消则维持只读模式。",
    fields: [
      {
        kind: "password",
        name: "password",
        label: "管理员密码",
        placeholder: "请输入管理员密码",
        required: true,
        maxLength: 128,
      },
    ],
    confirmText: "确认授权",
    cancelText: "取消",
    tone: "purple",
  });
  if (!values) return false;

  const password = (values.password ?? "").trim();
  if (!password) return false;

  const authenticated = await loginWriteSession(password);
  if (!authenticated) {
    toast.error("管理员写入密码无效，请确认后重试。");
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

export async function getWriteSessionStatus(): Promise<WriteSessionStatus> {
  if (typeof window === "undefined") {
    return { authenticated: false, configured: false };
  }

  const response = await fetch(WRITE_SESSION_ENDPOINT, {
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) {
    return { authenticated: false, configured: false };
  }

  const payload = (await response.json().catch(() => null)) as {
    authenticated?: unknown;
    configured?: unknown;
  } | null;
  return {
    authenticated: Boolean(payload?.authenticated),
    configured: Boolean(payload?.configured),
  };
}

export async function logoutWriteSession(): Promise<void> {
  if (typeof window === "undefined") return;

  await fetch(WRITE_SESSION_ENDPOINT, {
    method: "DELETE",
    credentials: "same-origin",
  }).catch(() => null);
  forgetStoredApiKey();
  notifyWriteSessionChanged({ authenticated: false, configured: true });
}

export async function ensureWriteAuthorization(): Promise<boolean> {
  const status = await getWriteSessionStatus();
  if (status.authenticated) {
    forgetStoredApiKey();
    return true;
  }

  if (!status.configured) {
    toast.error("服务器未配置管理员登录密码，当前只能只读访问。");
    return false;
  }

  return requestWriteAuthorizationOnce();
}

export function getStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() || "";
}

export function setStoredApiKey(value: string): void {
  if (typeof window === "undefined") return;
  const next = value.trim();
  if (!next) {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(API_KEY_STORAGE_KEY, next);
}

export async function promptForApiKey(): Promise<AuthPromptResult> {
  if (typeof window === "undefined") return "cancelled";

  // Compatibility shim: any stale callers should enter the current write-session flow
  // instead of persisting a legacy x-api-key that causes repeated auth failures.
  forgetStoredApiKey();
  const authenticated = await requestWriteAuthorizationOnce();
  return authenticated ? "saved" : "cancelled";
}

export async function apiFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const response = await fetch(url, buildRequestInit(init, method));

  if (await isDashboardAccessFailure(response)) {
    notifyDashboardAccessRequired();
    return response;
  }

  if (!isWriteMethod(method) || !(await isWriteAuthFailure(response))) {
    return response;
  }

  const status = await getWriteSessionStatus();
  notifyWriteSessionChanged({
    authenticated: false,
    configured: status.configured,
  });
  toast.error("当前为只读模式", {
    id: "dashboard-read-only-write-blocked",
    description: status.configured
      ? "请先点击右下角“管理员登录”，登录后再执行修改。"
      : "服务器尚未配置管理员登录密码。",
  });
  return response;
}
