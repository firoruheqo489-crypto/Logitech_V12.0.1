import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type TrialEvidenceSlot = {
  id: string;
  label: string;
  imageUrl?: string;
};

type TrialEvidenceStageState = {
  slots: TrialEvidenceSlot[];
  groupNote: string;
  recordedAt: string | null;
  a4ImageUrl?: string;
};

type MoldTrialEvidenceStateRow = {
  mold_id: string;
  mold_no: string;
  stages_by_scope: unknown;
  trial_stages: unknown;
  cleared_trial_stages: unknown;
  updated_at: string;
};

type MoldTrialEvidenceRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MOLD_ID_REQUIRED'
  | 'MOLD_TRIAL_EVIDENCE_STATE_DELETE_FAILED'
  | 'MOLD_TRIAL_EVIDENCE_STATE_LOAD_FAILED'
  | 'MOLD_TRIAL_EVIDENCE_STATE_SAVE_FAILED';

const MOLD_TRIAL_EVIDENCE_ROUTE_ERROR_MESSAGES: Record<MoldTrialEvidenceRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MOLD_ID_REQUIRED: 'moldId is required',
  MOLD_TRIAL_EVIDENCE_STATE_DELETE_FAILED: 'Failed to delete mold trial evidence state',
  MOLD_TRIAL_EVIDENCE_STATE_LOAD_FAILED: 'Failed to load mold trial evidence state',
  MOLD_TRIAL_EVIDENCE_STATE_SAVE_FAILED: 'Failed to save mold trial evidence state',
};

const MOLD_TRIAL_EVIDENCE_STATE_TABLE = 'dashboard_mold_trial_evidence_states_v2';

let dashboardMoldTrialEvidenceTableReady: Promise<void> | null = null;

function sendMoldTrialEvidenceRouteError(
  res: Response,
  status: number,
  code: MoldTrialEvidenceRouteErrorCode,
): void {
  res.status(status).json({
    error: MOLD_TRIAL_EVIDENCE_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeIdentifier(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeGroupNote(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 20000);
}

function normalizeRecordedAt(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }

  return timestamp.toISOString();
}

function sanitizeSlot(value: unknown): TrialEvidenceSlot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeIdentifier(record.id, 100);
  if (!id) {
    return null;
  }

  const label = normalizeIdentifier(record.label, 200, id) || id;
  const imageUrl = normalizeIdentifier(record.imageUrl, 4000);

  return imageUrl ? { id, label, imageUrl } : { id, label };
}

function sanitizeSlots(value: unknown): TrialEvidenceSlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeSlot(item))
    .filter((item): item is TrialEvidenceSlot => item !== null);
}

function sanitizeStageState(value: unknown): TrialEvidenceStageState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      slots: [],
      groupNote: '',
      recordedAt: null,
      a4ImageUrl: undefined,
    };
  }

  const record = value as Record<string, unknown>;
  const a4ImageUrl = normalizeIdentifier(record.a4ImageUrl, 4000);
  return {
    slots: sanitizeSlots(record.slots),
    groupNote: normalizeGroupNote(record.groupNote),
    recordedAt: normalizeRecordedAt(record.recordedAt),
    a4ImageUrl: a4ImageUrl || undefined,
  };
}

function hasStageContent(stageState: TrialEvidenceStageState): boolean {
  return (
    stageState.groupNote.length > 0 ||
    stageState.recordedAt !== null ||
    (typeof stageState.a4ImageUrl === 'string' && stageState.a4ImageUrl.trim().length > 0) ||
    stageState.slots.some((slot) => typeof slot.imageUrl === 'string' && slot.imageUrl.trim().length > 0)
  );
}

function sanitizeStagesByScope(value: unknown): Record<string, TrialEvidenceStageState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce((acc, [stage, stageState]) => {
    if (!/^T\d+$/.test(stage)) {
      return acc;
    }

    const sanitizedStageState = sanitizeStageState(stageState);
    if (!hasStageContent(sanitizedStageState)) {
      return acc;
    }

    acc[stage] = sanitizedStageState;
    return acc;
  }, {} as Record<string, TrialEvidenceStageState>);
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

function deriveTrialStages(stagesByScope: Record<string, TrialEvidenceStageState>, trialStages: unknown): string[] {
  const sanitizedTrialStages = sanitizeTrialStages(trialStages);
  if (sanitizedTrialStages.length > 0) {
    return sanitizedTrialStages;
  }

  return sanitizeTrialStages(Object.keys(stagesByScope));
}

function sanitizeClearedTrialStages(value: unknown, trialStages: string[]): string[] {
  const sanitized = sanitizeTrialStages(value);
  if (trialStages.length === 0) {
    return sanitized;
  }

  const trialStageSet = new Set(trialStages);
  return sanitized.filter((stage) => trialStageSet.has(stage));
}

function readRequestIdentity(source: Request['query'] | Record<string, unknown>) {
  const moldId = normalizeIdentifier(source.moldId, 100);
  const moldNo = normalizeIdentifier(source.moldNo, 100);

  return { moldId, moldNo };
}

export function ensureDashboardMoldTrialEvidenceTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardMoldTrialEvidenceTableReady) {
    dashboardMoldTrialEvidenceTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${MOLD_TRIAL_EVIDENCE_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          stages_by_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
          trial_stages JSONB NOT NULL DEFAULT '[]'::jsonb,
          cleared_trial_stages JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no)
        )
      `);
      await dbSql.unsafe(`
        ALTER TABLE ${MOLD_TRIAL_EVIDENCE_STATE_TABLE}
        ADD COLUMN IF NOT EXISTS trial_stages JSONB NOT NULL DEFAULT '[]'::jsonb
      `);
      await dbSql.unsafe(`
        ALTER TABLE ${MOLD_TRIAL_EVIDENCE_STATE_TABLE}
        ADD COLUMN IF NOT EXISTS cleared_trial_stages JSONB NOT NULL DEFAULT '[]'::jsonb
      `);
    })();
  }

  return dashboardMoldTrialEvidenceTableReady;
}

export async function getDashboardMoldTrialEvidenceState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMoldTrialEvidenceRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo } = readRequestIdentity(req.query);
  if (!moldId) {
    sendMoldTrialEvidenceRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardMoldTrialEvidenceTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, stages_by_scope, trial_stages, cleared_trial_stages, updated_at
        FROM ${MOLD_TRIAL_EVIDENCE_STATE_TABLE}
        WHERE mold_id = $1 AND mold_no = $2
        LIMIT 1
      `,
      [moldId, moldNo],
    )) as MoldTrialEvidenceStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: {
        moldId: row.mold_id,
        moldNo: row.mold_no || '',
        stagesByScope: sanitizeStagesByScope(row.stages_by_scope),
        trialStages: deriveTrialStages(sanitizeStagesByScope(row.stages_by_scope), row.trial_stages),
        clearedTrialStages: sanitizeClearedTrialStages(
          row.cleared_trial_stages,
          deriveTrialStages(sanitizeStagesByScope(row.stages_by_scope), row.trial_stages),
        ),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/mold-trial-evidence-state error:', error);
    sendMoldTrialEvidenceRouteError(res, 500, 'MOLD_TRIAL_EVIDENCE_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardMoldTrialEvidenceState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMoldTrialEvidenceRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo } = readRequestIdentity(body);
  if (!moldId) {
    sendMoldTrialEvidenceRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const stagesByScope = sanitizeStagesByScope(body.stagesByScope);
  const trialStages = deriveTrialStages(stagesByScope, body.trialStages);
  const clearedTrialStages = sanitizeClearedTrialStages(body.clearedTrialStages, trialStages);

  try {
    await ensureDashboardMoldTrialEvidenceTable();

    if (Object.keys(stagesByScope).length === 0 && trialStages.length === 0) {
      await dbSql.unsafe(
        `DELETE FROM ${MOLD_TRIAL_EVIDENCE_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2`,
        [moldId, moldNo],
      );
      res.status(200).json({ success: true });
      return;
    }

    await dbSql.unsafe(
      `
        INSERT INTO ${MOLD_TRIAL_EVIDENCE_STATE_TABLE} (
          mold_id,
          mold_no,
          stages_by_scope,
          trial_stages,
          cleared_trial_stages,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no)
        DO UPDATE SET
          stages_by_scope = EXCLUDED.stages_by_scope,
          trial_stages = EXCLUDED.trial_stages,
          cleared_trial_stages = EXCLUDED.cleared_trial_stages,
          updated_at = NOW()
      `,
      [moldId, moldNo, JSON.stringify(stagesByScope), JSON.stringify(trialStages), JSON.stringify(clearedTrialStages)],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/mold-trial-evidence-state error:', error);
    sendMoldTrialEvidenceRouteError(res, 500, 'MOLD_TRIAL_EVIDENCE_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardMoldTrialEvidenceState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMoldTrialEvidenceRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo } = readRequestIdentity(req.query);
  if (!moldId) {
    sendMoldTrialEvidenceRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardMoldTrialEvidenceTable();
    await dbSql.unsafe(
      `DELETE FROM ${MOLD_TRIAL_EVIDENCE_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2`,
      [moldId, moldNo],
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/mold-trial-evidence-state error:', error);
    sendMoldTrialEvidenceRouteError(res, 500, 'MOLD_TRIAL_EVIDENCE_STATE_DELETE_FAILED');
  }
}
