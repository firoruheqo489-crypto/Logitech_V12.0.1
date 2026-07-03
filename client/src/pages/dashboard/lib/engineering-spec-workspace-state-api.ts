import { apiFetch } from '@/lib/api';

export type EngineeringSpecWorkspaceField = {
  label: string;
  value: string;
  multiline?: boolean;
};

export type EngineeringSpecWorkspaceSectionRow = {
  item: string;
  label: string;
  value: string;
  pending: boolean;
  status?: 'pass' | 'fail' | 'untested';
};

export type EngineeringSpecWorkspaceSectionGroup = {
  label: string;
  rows: EngineeringSpecWorkspaceSectionRow[];
};

export type EngineeringSpecWorkspaceSection = {
  label: string;
  groups: EngineeringSpecWorkspaceSectionGroup[];
};

export type EngineeringSpecWorkspaceEvidenceSlot = {
  id: string;
  label: string;
  imageUrl?: string;
};

export type EngineeringSpecWorkspaceInspectionTestProject = {
  testType?: string;
  sampleDeliveryDate?: string;
  testItemCount?: string;
  remark?: string;
};

export type EngineeringSpecWorkspaceOaInfo = {
  workflowName?: string;
  workflowNo?: string;
  reportStatus?: string;
};

export type EngineeringSpecWorkspaceState = {
  workspaceKey: string;
  sourceFileName: string;
  imageSrc?: string;
  qeConclusion?: string;
  inspectionTestProject?: EngineeringSpecWorkspaceInspectionTestProject;
  oaInfo?: EngineeringSpecWorkspaceOaInfo;
  metadata: {
    rowCount: number;
    columnCount: number;
    sectionCount: number;
    packagingCount: number;
    pendingCount: number;
  };
  header: {
    title: string;
    productType: EngineeringSpecWorkspaceField;
    sku: EngineeringSpecWorkspaceField;
    spu: EngineeringSpecWorkspaceField;
    description: EngineeringSpecWorkspaceField;
  };
  packaging: Array<{
    label: string;
    value: string;
  }>;
  businessMeta: EngineeringSpecWorkspaceField[];
  sections: EngineeringSpecWorkspaceSection[];
  evidenceSlots: EngineeringSpecWorkspaceEvidenceSlot[];
};

function buildEngineeringSpecWorkspaceStateUrl(workspaceKey: string): string {
  const params = new URLSearchParams({ workspaceKey });
  return `/api/dashboard/engineering-spec-workspace-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export async function fetchEngineeringSpecWorkspaceState(
  workspaceKey: string,
): Promise<EngineeringSpecWorkspaceState | null> {
  const response = await apiFetch(buildEngineeringSpecWorkspaceStateUrl(workspaceKey));
  const payload = (await response.json().catch(() => null)) as
    | { state?: EngineeringSpecWorkspaceState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load engineering spec workspace state'));
  }

  return payload?.state ?? null;
}

export async function saveEngineeringSpecWorkspaceState(
  state: EngineeringSpecWorkspaceState,
): Promise<void> {
  const response = await apiFetch('/api/dashboard/engineering-spec-workspace-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save engineering spec workspace state'));
  }
}
