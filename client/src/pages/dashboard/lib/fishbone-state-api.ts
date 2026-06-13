import { apiFetch } from "@/lib/api";
import { normalizeDashboardApiError } from "./dashboardApi";
import type { FishboneDiagramState } from "../components/fishboneDiagramData";

export type DashboardFishboneRemoteState = {
  workspaceKey: string;
  state: FishboneDiagramState | null;
  updatedAt?: string;
};

type DashboardFishboneIdentity = {
  workspaceKey?: string;
};

const DEFAULT_WORKSPACE_KEY = "dashboard-fishbone-workspace";

function normalizeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildFishboneStateUrl(
  { workspaceKey = DEFAULT_WORKSPACE_KEY }: DashboardFishboneIdentity,
  cacheBuster?: number,
): string {
  const params = new URLSearchParams({ workspaceKey });
  if (typeof cacheBuster === "number" && Number.isFinite(cacheBuster)) {
    params.set("_ts", String(Math.trunc(cacheBuster)));
  }
  return `/api/dashboard/fishbone-state?${params.toString()}`;
}

export function normalizeFishboneWorkspaceKey(projectName?: string): string {
  const normalized = normalizeText(projectName).replace(/\s+/g, "-").toLowerCase();
  return normalized ? `dashboard-fishbone-${normalized}` : DEFAULT_WORKSPACE_KEY;
}

export async function fetchDashboardFishboneState(
  identity: DashboardFishboneIdentity = {},
): Promise<DashboardFishboneRemoteState> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildFishboneStateUrl({ workspaceKey }, Date.now()));
  const payload = (await response.json().catch(() => null)) as
    | { workspaceKey?: unknown; state?: unknown; updatedAt?: unknown; code?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, "UNKNOWN_ERROR");
  }

  return {
    workspaceKey: normalizeText(payload?.workspaceKey, workspaceKey),
    state: (payload?.state ?? null) as FishboneDiagramState | null,
    updatedAt: normalizeText(payload?.updatedAt) || undefined,
  };
}

export async function saveDashboardFishboneState(
  state: FishboneDiagramState,
  identity: DashboardFishboneIdentity = {},
): Promise<{ workspaceKey: string; updatedAt?: string }> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildFishboneStateUrl({ workspaceKey }, Date.now()), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceKey,
      state,
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { workspaceKey?: unknown; updatedAt?: unknown; code?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, "UNKNOWN_ERROR");
  }

  return {
    workspaceKey: normalizeText(payload?.workspaceKey, workspaceKey),
    updatedAt: normalizeText(payload?.updatedAt) || undefined,
  };
}
