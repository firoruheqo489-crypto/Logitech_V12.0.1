const DASHBOARD_ACCESS_SESSION_ENDPOINT = "/api/auth/access-session";

export const DASHBOARD_ACCESS_REQUIRED_EVENT = "dashboard-access-required";

export type DashboardAccessStatus = {
  authenticated: boolean;
  configured: boolean;
  reachable: boolean;
};

export type DashboardAccessLoginResult = {
  ok: boolean;
  code: string;
  retryAfterSeconds?: number;
};

function readPayloadCode(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return "";
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export function notifyDashboardAccessRequired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_ACCESS_REQUIRED_EVENT));
}

export async function getDashboardAccessStatus(): Promise<DashboardAccessStatus> {
  if (typeof window === "undefined") {
    return { authenticated: false, configured: false, reachable: false };
  }

  const response = await fetch(DASHBOARD_ACCESS_SESSION_ENDPOINT, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  }).catch(() => null);

  if (!response?.ok) {
    return { authenticated: false, configured: false, reachable: false };
  }

  const payload = (await response.json().catch(() => null)) as {
    authenticated?: unknown;
    configured?: unknown;
  } | null;

  return {
    authenticated: Boolean(payload?.authenticated),
    configured: Boolean(payload?.configured),
    reachable: true,
  };
}

export async function loginDashboardAccess(
  password: string
): Promise<DashboardAccessLoginResult> {
  const response = await fetch(DASHBOARD_ACCESS_SESSION_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  }).catch(() => null);

  if (!response) {
    return { ok: false, code: "NETWORK_ERROR" };
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const retryAfterHeader = Number.parseInt(
      response.headers.get("Retry-After") || "",
      10
    );
    const retryAfterPayload =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Number((payload as { retryAfterSeconds?: unknown }).retryAfterSeconds)
        : Number.NaN;
    const retryAfterSeconds = Number.isFinite(retryAfterHeader)
      ? retryAfterHeader
      : Number.isFinite(retryAfterPayload)
        ? retryAfterPayload
        : undefined;

    return {
      ok: false,
      code: readPayloadCode(payload) || `HTTP_${response.status}`,
      retryAfterSeconds,
    };
  }

  return { ok: true, code: "" };
}

export async function logoutDashboardAccess(): Promise<void> {
  if (typeof window === "undefined") return;

  await fetch(DASHBOARD_ACCESS_SESSION_ENDPOINT, {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => null);

  notifyDashboardAccessRequired();
}
