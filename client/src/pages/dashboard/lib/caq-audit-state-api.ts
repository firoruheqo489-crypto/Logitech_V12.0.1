import { apiFetch } from "@/lib/api";
import { normalizeDashboardApiError } from "./dashboardApi";

export type CaqAuditRootCause =
  | "wrong-model"
  | "boundary-confusion"
  | "calculation-error"
  | "concept-blindspot"
  | "";

export interface CaqAuditRecord {
  id: string;
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: CaqAuditRootCause;
  action: string;
  timestamp: number;
}

export interface CaqAuditEditableState {
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: CaqAuditRootCause;
  action: string;
}

export type CaqAuditEditingSource = "record" | "draft" | null;

export interface CaqAuditPersistedWorkspaceState extends CaqAuditEditableState {
  editingId: string | null;
  editingSource: CaqAuditEditingSource;
  baselineSignature: string;
}

export interface CaqAuditCategoryOption {
  value: string;
  label: string;
  tier: string;
}

export interface DashboardCaqAuditState {
  records: CaqAuditRecord[];
  drafts: CaqAuditRecord[];
  customCategories: CaqAuditCategoryOption[];
  workspace: CaqAuditPersistedWorkspaceState | null;
}

type DashboardCaqAuditIdentity = {
  workspaceKey?: string;
};

const DEFAULT_WORKSPACE_KEY = "caq-audit-default";

function normalizeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function buildCaqAuditStateUrl(
  { workspaceKey = DEFAULT_WORKSPACE_KEY }: DashboardCaqAuditIdentity,
  cacheBuster?: number,
): string {
  const params = new URLSearchParams({ workspaceKey });
  if (typeof cacheBuster === "number" && Number.isFinite(cacheBuster)) {
    params.set("_ts", String(Math.trunc(cacheBuster)));
  }
  return `/api/dashboard/caq-audit-state?${params.toString()}`;
}

export function normalizeCaqAuditWorkspaceKey(projectName?: string): string {
  const normalized = normalizeText(projectName).replace(/\s+/g, "-").toLowerCase();
  return normalized ? `caq-audit-${normalized}` : DEFAULT_WORKSPACE_KEY;
}

export async function fetchDashboardCaqAuditState(
  identity: DashboardCaqAuditIdentity = {},
): Promise<{ workspaceKey: string; state: DashboardCaqAuditState; updatedAt?: string }> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildCaqAuditStateUrl({ workspaceKey }, Date.now()));
  const payload = (await response.json().catch(() => null)) as
    | { workspaceKey?: unknown; state?: unknown; updatedAt?: unknown; code?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, "UNKNOWN_ERROR");
  }

  return {
    workspaceKey: normalizeText(payload?.workspaceKey, workspaceKey),
    state: (payload?.state ?? {
      records: [],
      drafts: [],
      customCategories: [],
      workspace: null,
    }) as DashboardCaqAuditState,
    updatedAt: normalizeText(payload?.updatedAt) || undefined,
  };
}

export async function saveDashboardCaqAuditState(
  state: DashboardCaqAuditState,
  identity: DashboardCaqAuditIdentity = {},
): Promise<{ workspaceKey: string; updatedAt?: string }> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildCaqAuditStateUrl({ workspaceKey }, Date.now()), {
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
