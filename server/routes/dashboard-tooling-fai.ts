import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type RowFilter = 'all' | 'qualified' | 'unqualified';
type ShotTuple = [number | null, number | null, number | null, number | null];

type ToolingFaiDataRow = {
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
  shots: ShotTuple;
  accuracyScore: number | null;
  toolingScore: number;
  measurementCount: number;
  qualifiedCount: number;
  isNG: boolean;
};

type ToolingFaiSummary = {
  totalRows: number;
  qualifiedRows: number;
  ngRows: number;
  totalMeasurements: number;
  qualifiedMeasurements: number;
  ngMeasurements: number;
  qualifiedRate: number | null;
};

type ToolingFaiStateRow = {
  mold_id: string;
  mold_no: string;
  trial_stage: string;
  file_name: string | null;
  active_filter: RowFilter;
  summary: unknown;
  data: unknown;
  updated_at: string;
};

type ToolingFaiRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MOLD_ID_REQUIRED'
  | 'TOOLING_FAI_STATE_LOAD_FAILED'
  | 'TOOLING_FAI_STATE_SAVE_FAILED'
  | 'TOOLING_FAI_STATE_DELETE_FAILED';

const TOOLING_FAI_ROUTE_ERROR_MESSAGES: Record<ToolingFaiRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MOLD_ID_REQUIRED: 'moldId is required',
  TOOLING_FAI_STATE_LOAD_FAILED: 'Failed to load Tooling FAI state',
  TOOLING_FAI_STATE_SAVE_FAILED: 'Failed to save Tooling FAI state',
  TOOLING_FAI_STATE_DELETE_FAILED: 'Failed to delete Tooling FAI state',
};

const EMPTY_SUMMARY: ToolingFaiSummary = {
  totalRows: 0,
  qualifiedRows: 0,
  ngRows: 0,
  totalMeasurements: 0,
  qualifiedMeasurements: 0,
  ngMeasurements: 0,
  qualifiedRate: null,
};

const TOOLING_FAI_STATE_TABLE = 'dashboard_tooling_fai_states_v2';

let dashboardToolingFaiTableReady: Promise<void> | null = null;

function sendToolingFaiRouteError(res: Response, status: number, code: ToolingFaiRouteErrorCode): void {
  res.status(status).json({
    error: TOOLING_FAI_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeIdentifier(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeFileName(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.slice(0, 255);
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const normalized = text.replace(/,/g, '').replace(/[^\d.+-]/g, '');
  if (!normalized || normalized === '+' || normalized === '-' || normalized === '.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeShotTuple(value: unknown): ShotTuple {
  if (!Array.isArray(value)) {
    return [null, null, null, null];
  }

  return [
    coerceNumber(value[0]),
    coerceNumber(value[1]),
    coerceNumber(value[2]),
    coerceNumber(value[3]),
  ];
}

function sanitizeRows(value: unknown): ToolingFaiDataRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const faiNo = normalizeIdentifier(record.faiNo, 100);
      if (!faiNo) {
        return null;
      }

      return {
        faiNo,
        partPrecision: normalizeIdentifier(record.partPrecision, 100),
        partDimension: coerceNumber(record.partDimension),
        plusTol: coerceNumber(record.plusTol),
        minusTol: coerceNumber(record.minusTol),
        toolingDimensionMinusC: coerceNumber(record.toolingDimensionMinusC),
        toolingDimension: coerceNumber(record.toolingDimension),
        toolingPlusTol: coerceNumber(record.toolingPlusTol),
        toolingMinusTol: coerceNumber(record.toolingMinusTol),
        process: normalizeIdentifier(record.process, 100),
        shots: sanitizeShotTuple(record.shots),
        accuracyScore: coerceNumber(record.accuracyScore),
        toolingScore: coerceNumber(record.toolingScore) ?? 0,
        measurementCount: coerceNumber(record.measurementCount) ?? 0,
        qualifiedCount: coerceNumber(record.qualifiedCount) ?? 0,
        isNG: Boolean(record.isNG),
      } satisfies ToolingFaiDataRow;
    })
    .filter((row): row is ToolingFaiDataRow => row !== null);
}

function sanitizeSummary(value: unknown): ToolingFaiSummary {
  if (!value || typeof value !== 'object') {
    return EMPTY_SUMMARY;
  }

  const record = value as Record<string, unknown>;
  return {
    totalRows: coerceNumber(record.totalRows) ?? 0,
    qualifiedRows: coerceNumber(record.qualifiedRows) ?? 0,
    ngRows: coerceNumber(record.ngRows) ?? 0,
    totalMeasurements: coerceNumber(record.totalMeasurements) ?? 0,
    qualifiedMeasurements: coerceNumber(record.qualifiedMeasurements) ?? 0,
    ngMeasurements: coerceNumber(record.ngMeasurements) ?? 0,
    qualifiedRate: coerceNumber(record.qualifiedRate),
  };
}

function normalizeActiveFilter(value: unknown): RowFilter {
  return value === 'qualified' || value === 'unqualified' ? value : 'all';
}

function readRequestIdentity(source: Request['query'] | Record<string, unknown>) {
  const moldId = normalizeIdentifier(source.moldId, 100);
  const moldNo = normalizeIdentifier(source.moldNo, 100);
  const trialStage = normalizeIdentifier(source.trialStage, 50, 'T0') || 'T0';

  return { moldId, moldNo, trialStage };
}

export function ensureDashboardToolingFaiTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardToolingFaiTableReady) {
    dashboardToolingFaiTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${TOOLING_FAI_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          trial_stage VARCHAR(50) NOT NULL,
          file_name VARCHAR(255),
          active_filter VARCHAR(20) NOT NULL DEFAULT 'all',
          summary JSONB NOT NULL DEFAULT '{}'::jsonb,
          data JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no, trial_stage)
        )
      `);
    })();
  }
  return dashboardToolingFaiTableReady;
}

export async function getDashboardToolingFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendToolingFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo, trialStage } = readRequestIdentity(req.query);
  if (!moldId) {
    sendToolingFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardToolingFaiTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, trial_stage, file_name, active_filter, summary, data, updated_at
        FROM ${TOOLING_FAI_STATE_TABLE}
        WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3
        LIMIT 1
      `,
      [moldId, moldNo, trialStage],
    )) as ToolingFaiStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: {
        moldId: row.mold_id,
        moldNo: row.mold_no || '',
        trialStage: row.trial_stage,
        fileName: row.file_name || '',
        activeFilter: normalizeActiveFilter(row.active_filter),
        summary: sanitizeSummary(row.summary),
        data: sanitizeRows(row.data),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/tooling-fai-state error:', error);
    sendToolingFaiRouteError(res, 500, 'TOOLING_FAI_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardToolingFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendToolingFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo, trialStage } = readRequestIdentity(body);
  if (!moldId) {
    sendToolingFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const fileName = normalizeFileName(body.fileName);
  const activeFilter = normalizeActiveFilter(body.activeFilter);
  const summary = sanitizeSummary(body.summary);
  const data = sanitizeRows(body.data);

  try {
    await ensureDashboardToolingFaiTable();
    await dbSql.unsafe(
      `
        INSERT INTO ${TOOLING_FAI_STATE_TABLE} (
          mold_id,
          mold_no,
          trial_stage,
          file_name,
          active_filter,
          summary,
          data,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no, trial_stage)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          active_filter = EXCLUDED.active_filter,
          summary = EXCLUDED.summary,
          data = EXCLUDED.data,
          updated_at = NOW()
      `,
      [
        moldId,
        moldNo,
        trialStage,
        fileName,
        activeFilter,
        JSON.stringify(summary),
        JSON.stringify(data),
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/tooling-fai-state error:', error);
    sendToolingFaiRouteError(res, 500, 'TOOLING_FAI_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardToolingFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendToolingFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo, trialStage } = readRequestIdentity(req.query);
  if (!moldId) {
    sendToolingFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardToolingFaiTable();
    await dbSql.unsafe(
      `DELETE FROM ${TOOLING_FAI_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3`,
      [moldId, moldNo, trialStage],
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/tooling-fai-state error:', error);
    sendToolingFaiRouteError(res, 500, 'TOOLING_FAI_STATE_DELETE_FAILED');
  }
}