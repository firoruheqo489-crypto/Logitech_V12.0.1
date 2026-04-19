import { apiFetch } from './api';

export type PartFaiRowFilter = 'all' | 'qualified' | 'unqualified';

export type PartFaiColumnId =
  | 'dim'
  | 'fos'
  | 'plusTol'
  | 'minusTol'
  | 'usl'
  | 'lsl'
  | 'judgeFos'
  | 'cavity'
  | 'fosShot1'
  | 'fosShot2'
  | 'fosShot3'
  | 'judgeGtol'
  | 'gtolShot1'
  | 'gtolShot2'
  | 'gtolShot3';

export type PartFaiShotTuple = [number | null, number | null, number | null];

export type PartFaiDataRow = {
  faiSet: string;
  dim: string;
  dimType: string;
  cavity: string;
  fos: number | null;
  plusTol: number | null;
  minusTol: number | null;
  usl: number | null;
  lsl: number | null;
  judgeFos: string;
  judgeGtol: string;
  isNG: boolean;
  fosShots: PartFaiShotTuple;
  gtolShots: PartFaiShotTuple;
};

export type PartFaiParseSummary = {
  totalRows: number;
  ngRows: number;
  qualifiedRows: number;
  qualifiedRate: number | null;
};

export type PartFaiRemoteState = {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
  fileName: string;
  activeFilter: PartFaiRowFilter;
  hiddenColumns: PartFaiColumnId[];
  summary: PartFaiParseSummary;
  data: PartFaiDataRow[];
  updatedAt?: string;
};

type PartFaiIdentity = {
  moldId: string;
  moldNo?: string;
  trialStage?: string;
};

function buildPartFaiStateUrl({ moldId, moldNo, trialStage }: PartFaiIdentity): string {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
    trialStage: trialStage || 'T0',
  });

  return `/api/dashboard/part-fai-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function fetchPartFaiState(identity: PartFaiIdentity): Promise<PartFaiRemoteState | null> {
  const response = await apiFetch(buildPartFaiStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as { state?: PartFaiRemoteState | null; error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load Part FAI state'));
  }

  return payload?.state ?? null;
}

export async function savePartFaiState(state: PartFaiRemoteState): Promise<void> {
  const response = await apiFetch('/api/dashboard/part-fai-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save Part FAI state'));
  }
}

export async function deletePartFaiState(identity: PartFaiIdentity): Promise<void> {
  const response = await apiFetch(buildPartFaiStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to delete Part FAI state'));
  }
}
