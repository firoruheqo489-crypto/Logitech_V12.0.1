import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';

type MoldTrialStagesStateRow = {
  mold_id: string;
  mold_no: string;
  trial_stages: unknown;
  updated_at: string;
};

type MoldTrialStagesRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MOLD_ID_REQUIRED'
  | 'MOLD_TRIAL_STAGES_LOAD_FAILED'
  | 'MOLD_TRIAL_STAGES_SAVE_FAILED';

const MOLD_TRIAL_STAGES_ROUTE_ERROR_MESSAGES: Record<MoldTrialStagesRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MOLD_ID_REQUIRED: 'moldId is required',
  MOLD_TRIAL_STAGES_LOAD_FAILED: 'Failed to load mold trial stages',
  MOLD_TRIAL_STAGES_SAVE_FAILED: 'Failed to save mold trial stages',
};

const MOLD_TRIAL_STAGES_TABLE = 'dashboard_mold_trial_stage_states';
const TRIAL_STAGE_PATTERN = /^T\d+$/;
const DEFAULT_TRIAL_STAGES = ['T0'];

let dashboardMoldTrialStagesTableReady: Promise<void> | null = null;

function sendMoldTrialStagesRouteError(
  res: Response,
  status: number,
  code: MoldTrialStagesRouteErrorCode,
): void {
  res.status(status).json({
    error: MOLD_TRIAL_STAGES_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeIdentifier(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeMoldNo(value: unknown): string {
  const normalized = normalizeIdentifier(value, 100);
  if (!normalized) {
    return '';
  }

  const digits = normalized.match(/\d+/)?.[0];
  if (!digits) {
    return normalized;
  }

  return `No. ${Number.parseInt(digits, 10)}`;
}

function buildMoldNoCandidates(value: unknown): [string, string, string, string] {
  const raw = normalizeIdentifier(value, 100);
  const canonical = normalizeMoldNo(value);
  const compactRaw = raw.replace(/\s+/g, '');
  const compactCanonical = canonical.replace(/\s+/g, '');
  const candidates = Array.from(
    new Set([canonical, raw, compactRaw, compactCanonical].filter(Boolean)),
  );

  if (candidates.length === 0) {
    return ['', '', '', ''];
  }

  while (candidates.length < 4) {
    candidates.push(candidates[candidates.length - 1] || '');
  }

  return [
    candidates[0] || '',
    candidates[1] || candidates[0] || '',
    candidates[2] || candidates[0] || '',
    candidates[3] || candidates[0] || '',
  ];
}

function readRequestIdentity(source: Request['query'] | Record<string, unknown>) {
  const moldId = normalizeIdentifier(source.moldId, 100);
  const moldNo = normalizeMoldNo(source.moldNo);
  const moldNoCandidates = buildMoldNoCandidates(source.moldNo);
  return { moldId, moldNo, moldNoCandidates };
}

function sanitizeTrialStages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_TRIAL_STAGES];
  }

  const uniqueStages = Array.from(
    new Set(
      value.filter(
        (stage): stage is string => typeof stage === 'string' && TRIAL_STAGE_PATTERN.test(stage),
      ),
    ),
  ).sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));

  if (uniqueStages.length === 0) {
    return [...DEFAULT_TRIAL_STAGES];
  }

  const maxStageIndex = uniqueStages.reduce((maxIndex, stage) => {
    const parsed = Number.parseInt(stage.slice(1), 10);
    if (!Number.isFinite(parsed)) return maxIndex;
    return Math.max(maxIndex, parsed);
  }, 0);

  return Array.from({ length: maxStageIndex + 1 }, (_, index) => `T${index}`);
}

export function ensureDashboardMoldTrialStagesTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardMoldTrialStagesTableReady) {
    dashboardMoldTrialStagesTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${MOLD_TRIAL_STAGES_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          trial_stages JSONB NOT NULL DEFAULT '["T0"]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no)
        )
      `);
    })();
  }

  return dashboardMoldTrialStagesTableReady;
}

export async function getDashboardMoldTrialStagesState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMoldTrialStagesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNoCandidates } = readRequestIdentity(req.query);
  if (!moldId) {
    sendMoldTrialStagesRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardMoldTrialStagesTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, trial_stages, updated_at
        FROM ${MOLD_TRIAL_STAGES_TABLE}
        WHERE mold_id = $1 AND mold_no IN ($2, $3, $4, $5)
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [moldId, moldNoCandidates[0], moldNoCandidates[1], moldNoCandidates[2], moldNoCandidates[3]],
    )) as MoldTrialStagesStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: {
        moldId: row.mold_id,
        moldNo: row.mold_no || '',
        trialStages: sanitizeTrialStages(row.trial_stages),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/mold-trial-stages error:', error);
    sendMoldTrialStagesRouteError(res, 500, 'MOLD_TRIAL_STAGES_LOAD_FAILED');
  }
}

export async function upsertDashboardMoldTrialStagesState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMoldTrialStagesRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo, moldNoCandidates } = readRequestIdentity(body);
  if (!moldId) {
    sendMoldTrialStagesRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const trialStages = sanitizeTrialStages(body.trialStages);

  try {
    await ensureDashboardMoldTrialStagesTable();

    if (trialStages.length <= 1) {
      await dbSql.unsafe(
        `
          DELETE FROM ${MOLD_TRIAL_STAGES_TABLE}
          WHERE mold_id = $1 AND mold_no IN ($2, $3, $4, $5)
        `,
        [moldId, moldNoCandidates[0], moldNoCandidates[1], moldNoCandidates[2], moldNoCandidates[3]],
      );
      res.status(200).json({ success: true });
      return;
    }

    await dbSql.unsafe(
      `
        INSERT INTO ${MOLD_TRIAL_STAGES_TABLE} (
          mold_id,
          mold_no,
          trial_stages,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no)
        DO UPDATE SET
          trial_stages = EXCLUDED.trial_stages,
          updated_at = NOW()
      `,
      [moldId, moldNo, JSON.stringify(trialStages)],
    );
    await dbSql.unsafe(
      `
        DELETE FROM ${MOLD_TRIAL_STAGES_TABLE}
        WHERE mold_id = $1
          AND mold_no IN ($2, $3, $4, $5)
          AND mold_no <> $6
      `,
      [
        moldId,
        moldNoCandidates[0],
        moldNoCandidates[1],
        moldNoCandidates[2],
        moldNoCandidates[3],
        moldNo,
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/mold-trial-stages error:', error);
    sendMoldTrialStagesRouteError(res, 500, 'MOLD_TRIAL_STAGES_SAVE_FAILED');
  }
}
