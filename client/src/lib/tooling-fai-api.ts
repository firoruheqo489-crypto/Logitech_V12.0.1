import { apiFetch } from './api';

export type ToolingFaiRowFilter = 'all' | 'qualified' | 'unqualified';

export type ToolingFaiShotTuple = [number | null, number | null, number | null, number | null];

export type ToolingFaiDataRow = {
  faiNo: string;
  partPrecision: string;
  partDimension: number | null;
  plusTol: number | null;
  minusTol: number | null;
  toolingDimensionMinusC: number | null;
  toolingDimension: number | null;
  toolingPlusTol: number | null;
  toolingMinusTol: number | null;
  process: string;
  shots: ToolingFaiShotTuple;
  accuracyScore: number | null;
  toolingScore: number;
  measurementCount: number;
  qualifiedCount: number;
  isNG: boolean;
};

export type ToolingFaiParseSummary = {
  totalRows: number;
  qualifiedRows: number;
  ngRows: number;
  totalMeasurements: number;
  qualifiedMeasurements: number;
  ngMeasurements: number;
  qualifiedRate: number | null;
};

export type ToolingFaiRemoteState = {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
  fileName: string;
  activeFilter: ToolingFaiRowFilter;
  summary: ToolingFaiParseSummary;
  data: ToolingFaiDataRow[];
  updatedAt?: string;
};

type ToolingFaiIdentity = {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
};

function buildToolingFaiStateUrl({ moldId, moldNo, trialStage }: ToolingFaiIdentity): string {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
    trialStage: trialStage || 'T0',
  });

  return `/api/dashboard/tooling-fai-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function fetchToolingFaiState(identity: ToolingFaiIdentity): Promise<ToolingFaiRemoteState | null> {
  const response = await apiFetch(buildToolingFaiStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as { state?: ToolingFaiRemoteState | null; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load Tooling FAI state'));
  }

  return payload?.state ?? null;
}

export async function saveToolingFaiState(state: ToolingFaiRemoteState): Promise<void> {
  const response = await apiFetch('/api/dashboard/tooling-fai-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save Tooling FAI state'));
  }
}

export async function deleteToolingFaiState(identity: ToolingFaiIdentity): Promise<void> {
  const response = await apiFetch(buildToolingFaiStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to delete Tooling FAI state'));
  }
}