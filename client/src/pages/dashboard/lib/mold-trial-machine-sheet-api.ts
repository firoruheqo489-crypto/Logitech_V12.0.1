import { apiFetch } from '@/lib/api';

export type MachineSheetStageMap = Record<string, string>;

export type MachineSheetRemoteState = {
  moldId: string;
  moldNo?: string;
  stagesByTrial: MachineSheetStageMap;
  updatedAt?: string;
};

type MachineSheetIdentity = {
  moldId: string;
  moldNo?: string;
};

function buildMachineSheetStateUrl({ moldId, moldNo }: MachineSheetIdentity): string {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
  });

  return `/api/dashboard/machine-sheet-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function sanitizeStagesByTrial(value: unknown): MachineSheetStageMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce((acc, [stage, imageUrl]) => {
    if (/^T\d+$/.test(stage) && typeof imageUrl === 'string') {
      const trimmed = imageUrl.trim();
      if (trimmed) {
        acc[stage] = trimmed;
      }
    }
    return acc;
  }, {} as MachineSheetStageMap);
}

export async function fetchDashboardMachineSheetState(
  identity: MachineSheetIdentity,
): Promise<MachineSheetRemoteState | null> {
  const response = await apiFetch(buildMachineSheetStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as
    | { state?: MachineSheetRemoteState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load machine sheet state'));
  }

  const state = payload?.state ?? null;
  if (!state) {
    return null;
  }

  return {
    moldId: String(state.moldId ?? identity.moldId).trim(),
    moldNo: String(state.moldNo ?? identity.moldNo ?? '').trim() || undefined,
    stagesByTrial: sanitizeStagesByTrial(state.stagesByTrial),
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
  };
}

export async function saveDashboardMachineSheetState(state: MachineSheetRemoteState): Promise<void> {
  const response = await apiFetch('/api/dashboard/machine-sheet-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save machine sheet state'));
  }
}
