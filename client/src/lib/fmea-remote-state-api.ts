import { apiFetch } from './api';

export type FmeaRemoteModule = 'dfmea' | 'pfmea';

type FmeaRemoteStateIdentity = {
  module: FmeaRemoteModule;
  workspaceKey?: string;
};

export type FmeaRemoteHeaderFields = {
  projectName: string;
  partNumber: string;
  owner: string;
  reviewDate: string;
};

export type DfmeaRemoteRow = {
  id: string;
  systemId: string;
  process: string;
  mode: string;
  effect: string;
  classification: 'CC' | 'SC' | 'STD';
  crossRisk: string;
  sev: number;
  cause: string;
  pc: string;
  occ: number;
  dc: string;
  det: number;
  rpn: number;
  dvprLinks: string[];
  action: string;
  ownerGate: string;
  status: 'pending' | 'testing' | 'closed';
};

export type PfmeaRemoteRow = {
  id: string;
  areaId: string;
  opCode: string;
  process: string;
  requirement: string;
  effect: string;
  sev: number;
  vector: 'man' | 'machine' | 'material' | 'method' | 'environment';
  cause: string;
  occ: number;
  pc: string;
  dc: string;
  pokaYoke: 'ccd' | 'sensor' | 'fixture' | 'visual' | 'program';
  det: number;
  rpn: number;
  action: string;
  ownerGate: string;
  status: 'pending' | 'testing' | 'closed';
};

export type DfmeaRemoteWorkspaceState = {
  module: 'dfmea';
  workspaceKey: string;
  activeNodeId: string;
  headerFields: FmeaRemoteHeaderFields;
  tableData: DfmeaRemoteRow[];
  archiveCurrentDocumentId?: string | null;
  updatedAt?: string;
};

export type PfmeaRemoteWorkspaceState = {
  module: 'pfmea';
  workspaceKey: string;
  activeNodeId: string;
  headerFields: FmeaRemoteHeaderFields;
  tableData: PfmeaRemoteRow[];
  archiveCurrentDocumentId?: string | null;
  updatedAt?: string;
};

export type FmeaRemoteWorkspaceState =
  | DfmeaRemoteWorkspaceState
  | PfmeaRemoteWorkspaceState;

export const DEFAULT_FMEA_WORKSPACE_KEYS: Record<FmeaRemoteModule, string> = {
  dfmea: 'dashboard-dfmea-workspace',
  pfmea: 'dashboard-pfmea-workspace',
};

function buildFmeaStateUrl({
  module,
  workspaceKey = DEFAULT_FMEA_WORKSPACE_KEYS[module],
}: FmeaRemoteStateIdentity): string {
  const params = new URLSearchParams({
    module,
    workspaceKey,
  });

  return `/api/dashboard/fmea-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function fetchFmeaRemoteWorkspaceState<TState extends FmeaRemoteWorkspaceState>(
  identity: FmeaRemoteStateIdentity,
): Promise<TState | null> {
  const response = await apiFetch(buildFmeaStateUrl(identity), {
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => null)) as
    | { state?: TState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load FMEA state'));
  }

  return payload?.state ?? null;
}

export async function saveFmeaRemoteWorkspaceState(
  state: FmeaRemoteWorkspaceState,
): Promise<{ updatedAt?: string }> {
  const response = await apiFetch('/api/dashboard/fmea-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as
    | { updatedAt?: string; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save FMEA state'));
  }

  return {
    updatedAt: typeof payload?.updatedAt === 'string' ? payload.updatedAt : undefined,
  };
}

export async function deleteFmeaRemoteWorkspaceState(
  identity: FmeaRemoteStateIdentity,
): Promise<void> {
  const response = await apiFetch(buildFmeaStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to delete FMEA state'));
  }
}
