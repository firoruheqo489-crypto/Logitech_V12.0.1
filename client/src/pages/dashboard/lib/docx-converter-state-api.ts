import { apiFetch } from '@/lib/api';
import type { ParseResult } from './docxConvertParser';

export type DocxConverterRemoteStageState = {
  fileName?: string;
  fileUrl?: string;
  result?: ParseResult | null;
};

export type DocxConverterRemoteState = {
  moldId: string;
  moldNo?: string;
  trialStages: string[];
  activeTrial: string;
  stageStateByTrial: Record<string, DocxConverterRemoteStageState>;
  updatedAt?: string;
};

type DocxConverterIdentity = {
  moldId: string;
  moldNo?: string;
};

const DEFAULT_HEADERS = [
  'No.',
  'Issue Description',
  'Pictures',
  'Root Cause',
  'Solution',
  'Owner',
  'Due-Date',
  'Status',
  'Reference Link',
];

function buildDocxConverterStateUrl({ moldId, moldNo }: DocxConverterIdentity): string {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
  });
  return `/api/dashboard/docx-converter-state?${params.toString()}`;
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const message = (payload as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function sanitizeTrialStages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter((stage): stage is string => typeof stage === 'string' && /^T\d+$/.test(stage)),
    ),
  ).sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));
}

function sanitizeParseResult(value: unknown): ParseResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const headers = Array.isArray(record.headers)
    ? record.headers.slice(0, 9).map((header) => String(header ?? '').trim())
    : [...DEFAULT_HEADERS];
  while (headers.length < 9) {
    headers.push(DEFAULT_HEADERS[headers.length] || '');
  }

  const rows = Array.isArray(record.rows)
    ? record.rows
        .map((row) => {
          if (!Array.isArray(row)) {
            return null;
          }

          const normalizedRow = row.slice(0, 9).map((cell) => {
            if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
              return { text: '', images: [] };
            }

            const cellRecord = cell as Record<string, unknown>;
            const images = Array.isArray(cellRecord.images)
              ? cellRecord.images
                  .map((image) => {
                    if (!image || typeof image !== 'object' || Array.isArray(image)) {
                      return null;
                    }

                    const imageRecord = image as Record<string, unknown>;
                    const base64 = String(imageRecord.base64 ?? '').trim();
                    if (!base64) {
                      return null;
                    }

                    return {
                      base64,
                      mimeType: String(imageRecord.mimeType ?? 'image/png').trim() || 'image/png',
                      extension: String(imageRecord.extension ?? 'png').trim() || 'png',
                    };
                  })
                  .filter((image): image is { base64: string; mimeType: string; extension: string } => image !== null)
              : [];

            return {
              text: String(cellRecord.text ?? ''),
              images,
            };
          });
          while (normalizedRow.length < 9) {
            normalizedRow.push({ text: '', images: [] });
          }
          return normalizedRow;
        })
        .filter(
          (row): row is Array<{ text: string; images: Array<{ base64: string; mimeType: string; extension: string }> }> =>
            row !== null,
        )
    : [];

  const hasAnyContent = rows.some((row) => row.some((cell) => cell.text.trim() || cell.images.length > 0));
  if (!hasAnyContent) {
    return null;
  }

  return {
    headers,
    rows,
    columnCount: 9,
  };
}

function sanitizeStageStateByTrial(value: unknown): Record<string, DocxConverterRemoteStageState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce((acc, [stage, stageState]) => {
    if (!/^T\d+$/.test(stage) || !stageState || typeof stageState !== 'object' || Array.isArray(stageState)) {
      return acc;
    }

    const record = stageState as Record<string, unknown>;
    const fileName = String(record.fileName ?? '').trim();
    const fileUrl = String(record.fileUrl ?? '').trim();
    const result = sanitizeParseResult(record.result);
    if (!fileName && !fileUrl && !result) {
      return acc;
    }

    acc[stage] = {
      fileName: fileName || undefined,
      fileUrl: fileUrl || undefined,
      result,
    };
    return acc;
  }, {} as Record<string, DocxConverterRemoteStageState>);
}

function sanitizeActiveTrial(value: unknown, trialStages: string[]): string {
  const fallback = trialStages[0] || 'T0';
  const normalized = String(value ?? '').trim().toUpperCase();
  return trialStages.includes(normalized) ? normalized : fallback;
}

export async function fetchDashboardDocxConverterState(
  identity: DocxConverterIdentity,
): Promise<DocxConverterRemoteState | null> {
  const response = await apiFetch(buildDocxConverterStateUrl(identity));
  const payload = (await response.json().catch(() => null)) as
    | { state?: DocxConverterRemoteState | null; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to load docx converter state'));
  }

  const state = payload?.state ?? null;
  if (!state) {
    return null;
  }

  const stageStateByTrial = sanitizeStageStateByTrial((state as { stageStateByTrial?: unknown }).stageStateByTrial);
  const trialStages = sanitizeTrialStages((state as { trialStages?: unknown }).trialStages);
  const finalTrialStages =
    trialStages.length > 0
      ? trialStages
      : sanitizeTrialStages(Object.keys(stageStateByTrial).length > 0 ? Object.keys(stageStateByTrial) : ['T0', 'T1', 'T2', 'T3']);

  return {
    moldId: String(state.moldId ?? identity.moldId).trim(),
    moldNo: String(state.moldNo ?? identity.moldNo ?? '').trim() || undefined,
    trialStages: finalTrialStages,
    activeTrial: sanitizeActiveTrial((state as { activeTrial?: unknown }).activeTrial, finalTrialStages),
    stageStateByTrial,
    updatedAt: typeof state.updatedAt === 'string' ? state.updatedAt : undefined,
  };
}

export async function saveDashboardDocxConverterState(state: DocxConverterRemoteState): Promise<void> {
  const response = await apiFetch('/api/dashboard/docx-converter-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to save docx converter state'));
  }
}

export async function deleteDashboardDocxConverterState(identity: DocxConverterIdentity): Promise<void> {
  const response = await apiFetch(buildDocxConverterStateUrl(identity), {
    method: 'DELETE',
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, 'Failed to delete docx converter state'));
  }
}
