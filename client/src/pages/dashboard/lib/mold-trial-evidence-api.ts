import { apiFetch } from '@/lib/api';

export type MoldTrialEvidenceRemoteSlot = {
  id: string;
  label: string;
  imageUrl?: string;
};

export type MoldTrialEvidenceRemoteStageState = {
  slots: MoldTrialEvidenceRemoteSlot[];
  groupNote: string;
  recordedAt: string | null;
};

export type MoldTrialEvidenceRemoteState = {
  moldId: string;
  moldNo?: string;
  stagesByScope: Record<string, MoldTrialEvidenceRemoteStageState>;
  updatedAt?: string;
};

type MoldTrialEvidenceIdentity = {
  moldId: string;
  moldNo?: string;
};

function buildMoldTrialEvidenceStateUrl({ moldId, moldNo }: MoldTrialEvidenceIdentity): string {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
  });

  return `/api/dashboard/mold-trial-evidence-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function sanitizeStagesByScope(value: unknown): Record<string, MoldTrialEvidenceRemoteStageState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce((acc, [stage, stageState]) => {
    if (!/^T\d+$/.test(stage) || !stageState || typeof stageState !== 'object' || Array.isArray(stageState)) {
      return acc;
    }

    const record = stageState as Record<string, unknown>;
    acc[stage] = {
      slots: Array.isArray(record.slots) ? (record.slots as MoldTrialEvidenceRemoteSlot[]) : [],
      groupNote: typeof record.groupNote === 'string' ? record.groupNote : '',
      recordedAt: typeof record.recordedAt === 'string' ? record.recordedAt : null,
    };
    return acc;
  }, {} as Record<string, MoldTrialEvidenceRemoteStageState>);
}

export async function fetchDashboardMoldTrialEvidenceState(
  identity: MoldTrialEvidenceIdentity,
): Promise<MoldTrialEvidenceRemoteState | null> {
  const response = await apiFetch(buildMoldTrialEvidenceStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as
    | { state?: MoldTrialEvidenceRemoteState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load mold trial evidence state'));
  }

  const state = payload?.state ?? null;
  if (!state) {
    return null;
  }

  return {
    moldId: String(state.moldId ?? identity.moldId).trim(),
    moldNo: String(state.moldNo ?? identity.moldNo ?? '').trim() || undefined,
    stagesByScope: sanitizeStagesByScope(state.stagesByScope),
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
  };
}

export async function saveDashboardMoldTrialEvidenceState(
  state: MoldTrialEvidenceRemoteState,
): Promise<void> {
  const response = await apiFetch('/api/dashboard/mold-trial-evidence-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save mold trial evidence state'));
  }
}

export async function deleteDashboardMoldTrialEvidenceState(
  identity: MoldTrialEvidenceIdentity,
): Promise<void> {
  const response = await apiFetch(buildMoldTrialEvidenceStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to delete mold trial evidence state'));
  }
}