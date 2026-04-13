import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type RowFilter = 'all' | 'qualified' | 'unqualified';
type ColumnId =
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

type ShotTuple = [number | null, number | null, number | null];

type PartFaiDataRow = {
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
  fosShots: ShotTuple;
  gtolShots: ShotTuple;
};

type PartFaiSummary = {
  totalRows: number;
  ngRows: number;
  qualifiedRows: number;
  qualifiedRate: number | null;
};

type PartFaiStateRow = {
  mold_id: string;
  mold_no: string;
  trial_stage: string;
  file_name: string | null;
  active_filter: RowFilter;
  hidden_columns: unknown;
  summary: unknown;
  data: unknown;
  updated_at: string;
};

type PartFaiRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MOLD_ID_REQUIRED'
  | 'PART_FAI_STATE_LOAD_FAILED'
  | 'PART_FAI_STATE_SAVE_FAILED'
  | 'PART_FAI_STATE_DELETE_FAILED';

const PART_FAI_ROUTE_ERROR_MESSAGES: Record<PartFaiRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MOLD_ID_REQUIRED: 'moldId is required',
  PART_FAI_STATE_LOAD_FAILED: 'Failed to load Part FAI state',
  PART_FAI_STATE_SAVE_FAILED: 'Failed to save Part FAI state',
  PART_FAI_STATE_DELETE_FAILED: 'Failed to delete Part FAI state',
};

const EMPTY_SUMMARY: PartFaiSummary = {
  totalRows: 0,
  ngRows: 0,
  qualifiedRows: 0,
  qualifiedRate: null,
};

const PART_FAI_STATE_TABLE = 'dashboard_part_fai_states_v2';

const COLUMN_IDS: ColumnId[] = [
  'dim',
  'fos',
  'plusTol',
  'minusTol',
  'usl',
  'lsl',
  'judgeFos',
  'cavity',
  'fosShot1',
  'fosShot2',
  'fosShot3',
  'judgeGtol',
  'gtolShot1',
  'gtolShot2',
  'gtolShot3',
];

let dashboardPartFaiTableReady: Promise<void> | null = null;

function sendPartFaiRouteError(res: Response, status: number, code: PartFaiRouteErrorCode): void {
  res.status(status).json({
    error: PART_FAI_ROUTE_ERROR_MESSAGES[code],
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

function normalizeJudge(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().slice(0, 50);
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? '').trim();
  if (!text) return null;

  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeShotTuple(value: unknown): ShotTuple {
  if (!Array.isArray(value)) {
    return [null, null, null];
  }

  return [coerceNumber(value[0]), coerceNumber(value[1]), coerceNumber(value[2])];
}

function sanitizeRows(value: unknown): PartFaiDataRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const dim = normalizeIdentifier(record.dim, 100);
      if (!dim) {
        return null;
      }

      return {
        dim,
        dimType: normalizeIdentifier(record.dimType, 100),
        cavity: normalizeIdentifier(record.cavity, 100),
        fos: coerceNumber(record.fos),
        plusTol: coerceNumber(record.plusTol),
        minusTol: coerceNumber(record.minusTol),
        usl: coerceNumber(record.usl),
        lsl: coerceNumber(record.lsl),
        judgeFos: normalizeJudge(record.judgeFos),
        judgeGtol: normalizeJudge(record.judgeGtol),
        isNG: Boolean(record.isNG),
        fosShots: sanitizeShotTuple(record.fosShots),
        gtolShots: sanitizeShotTuple(record.gtolShots),
      } satisfies PartFaiDataRow;
    })
    .filter((row): row is PartFaiDataRow => row !== null);
}

function sanitizeSummary(value: unknown): PartFaiSummary {
  if (!value || typeof value !== 'object') {
    return EMPTY_SUMMARY;
  }

  const record = value as Record<string, unknown>;
  return {
    totalRows: coerceNumber(record.totalRows) ?? 0,
    ngRows: coerceNumber(record.ngRows) ?? 0,
    qualifiedRows: coerceNumber(record.qualifiedRows) ?? 0,
    qualifiedRate: coerceNumber(record.qualifiedRate),
  };
}

function sanitizeHiddenColumns(value: unknown): ColumnId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? ''))
        .filter((item): item is ColumnId => COLUMN_IDS.includes(item as ColumnId)),
    ),
  );
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

export function ensureDashboardPartFaiTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardPartFaiTableReady) {
    dashboardPartFaiTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${PART_FAI_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          trial_stage VARCHAR(50) NOT NULL,
          file_name VARCHAR(255),
          active_filter VARCHAR(20) NOT NULL DEFAULT 'all',
          hidden_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
          summary JSONB NOT NULL DEFAULT '{}'::jsonb,
          data JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no, trial_stage)
        )
      `);
    })();
  }
  return dashboardPartFaiTableReady;
}

export async function getDashboardPartFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendPartFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo, trialStage } = readRequestIdentity(req.query);
  if (!moldId) {
    sendPartFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardPartFaiTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, trial_stage, file_name, active_filter, hidden_columns, summary, data, updated_at
        FROM ${PART_FAI_STATE_TABLE}
        WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3
        LIMIT 1
      `,
      [moldId, moldNo, trialStage],
    )) as PartFaiStateRow[];

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
        hiddenColumns: sanitizeHiddenColumns(row.hidden_columns),
        summary: sanitizeSummary(row.summary),
        data: sanitizeRows(row.data),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/part-fai-state error:', error);
    sendPartFaiRouteError(res, 500, 'PART_FAI_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardPartFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendPartFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo, trialStage } = readRequestIdentity(body);
  if (!moldId) {
    sendPartFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const fileName = normalizeFileName(body.fileName);
  const activeFilter = normalizeActiveFilter(body.activeFilter);
  const hiddenColumns = sanitizeHiddenColumns(body.hiddenColumns);
  const summary = sanitizeSummary(body.summary);
  const data = sanitizeRows(body.data);

  try {
    await ensureDashboardPartFaiTable();
    await dbSql.unsafe(
      `
        INSERT INTO ${PART_FAI_STATE_TABLE} (
          mold_id,
          mold_no,
          trial_stage,
          file_name,
          active_filter,
          hidden_columns,
          summary,
          data,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no, trial_stage)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          active_filter = EXCLUDED.active_filter,
          hidden_columns = EXCLUDED.hidden_columns,
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
        JSON.stringify(hiddenColumns),
        JSON.stringify(summary),
        JSON.stringify(data),
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/part-fai-state error:', error);
    sendPartFaiRouteError(res, 500, 'PART_FAI_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardPartFaiState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendPartFaiRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo, trialStage } = readRequestIdentity(req.query);
  if (!moldId) {
    sendPartFaiRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardPartFaiTable();
    await dbSql.unsafe(
      `DELETE FROM ${PART_FAI_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2 AND trial_stage = $3`,
      [moldId, moldNo, trialStage],
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/part-fai-state error:', error);
    sendPartFaiRouteError(res, 500, 'PART_FAI_STATE_DELETE_FAILED');
  }
}
