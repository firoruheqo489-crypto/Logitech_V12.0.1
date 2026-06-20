import { apiFetch } from '@/lib/api';
import { normalizeDashboardApiError } from './dashboardApi';
import type { GrrWorkspaceState } from '../components/grrEngine';

export type DashboardGrrRemoteState = {
  workspaceKey: string;
  state: GrrWorkspaceState | null;
  updatedAt?: string;
};

type DashboardGrrIdentity = {
  workspaceKey?: string;
};

const DEFAULT_WORKSPACE_KEY = 'dashboard-grr-workspace';

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function buildGrrStateUrl({ workspaceKey = DEFAULT_WORKSPACE_KEY }: DashboardGrrIdentity, cacheBuster?: number): string {
  const params = new URLSearchParams({ workspaceKey });
  if (typeof cacheBuster === 'number' && Number.isFinite(cacheBuster)) {
    params.set('_ts', String(Math.trunc(cacheBuster)));
  }
  return `/api/dashboard/grr-state?${params.toString()}`;
}

export function normalizeGrrWorkspaceKey(projectName?: string): string {
  const normalized = normalizeText(projectName).replace(/\s+/g, '-').toLowerCase();
  return normalized ? `dashboard-grr-${normalized}` : DEFAULT_WORKSPACE_KEY;
}

export async function fetchDashboardGrrState(
  identity: DashboardGrrIdentity = {},
): Promise<DashboardGrrRemoteState> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildGrrStateUrl({ workspaceKey }, Date.now()));
  const payload = (await response.json().catch(() => null)) as
    | { workspaceKey?: unknown; state?: unknown; updatedAt?: unknown; code?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, 'UNKNOWN_ERROR');
  }

  return {
    workspaceKey: normalizeText(payload?.workspaceKey, workspaceKey),
    state: (payload?.state ?? null) as GrrWorkspaceState | null,
    updatedAt: normalizeText(payload?.updatedAt) || undefined,
  };
}

export async function saveDashboardGrrState(
  state: GrrWorkspaceState,
  identity: DashboardGrrIdentity = {},
): Promise<{ workspaceKey: string; updatedAt?: string }> {
  const workspaceKey = identity.workspaceKey || DEFAULT_WORKSPACE_KEY;
  const response = await apiFetch(buildGrrStateUrl({ workspaceKey }, Date.now()), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceKey, state }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { workspaceKey?: unknown; updatedAt?: unknown; code?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    throw normalizeDashboardApiError(payload, response.status, 'UNKNOWN_ERROR');
  }

  return {
    workspaceKey: normalizeText(payload?.workspaceKey, workspaceKey),
    updatedAt: normalizeText(payload?.updatedAt) || undefined,
  };
}
