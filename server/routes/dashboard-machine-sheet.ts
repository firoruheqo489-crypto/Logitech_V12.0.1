import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type MachineSheetStateRow = {
  mold_id: string;
  mold_no: string;
  stages_by_trial: unknown;
  updated_at: string;
};

type MachineSheetRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'MACHINE_SHEET_STATE_LOAD_FAILED'
  | 'MACHINE_SHEET_STATE_SAVE_FAILED'
  | 'MOLD_ID_REQUIRED';

const MACHINE_SHEET_ROUTE_ERROR_MESSAGES: Record<MachineSheetRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  MACHINE_SHEET_STATE_LOAD_FAILED: 'Failed to load machine sheet state',
  MACHINE_SHEET_STATE_SAVE_FAILED: 'Failed to save machine sheet state',
  MOLD_ID_REQUIRED: 'moldId is required',
};

let dashboardMachineSheetTableReady: Promise<void> | null = null;

function sendMachineSheetRouteError(res: Response, status: number, code: MachineSheetRouteErrorCode): void {
  res.status(status).json({
    error: MACHINE_SHEET_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeIdentifier(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function readRequestIdentity(source: Request['query'] | Record<string, unknown>) {
  const moldId = normalizeIdentifier(source.moldId, 100);
  const moldNo = normalizeIdentifier(source.moldNo, 100);
  return { moldId, moldNo };
}

function sanitizeStagesByTrial(value: unknown): Record<string, string> {
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
  }, {} as Record<string, string>);
}

export function ensureDashboardMachineSheetTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardMachineSheetTableReady) {
    dashboardMachineSheetTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS dashboard_machine_sheet_states (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          stages_by_trial JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no)
        )
      `);
    })();
  }

  return dashboardMachineSheetTableReady;
}

export async function getDashboardMachineSheetState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMachineSheetRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo } = readRequestIdentity(req.query);
  if (!moldId) {
    sendMachineSheetRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardMachineSheetTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, stages_by_trial, updated_at
        FROM dashboard_machine_sheet_states
        WHERE mold_id = $1 AND mold_no = $2
        LIMIT 1
      `,
      [moldId, moldNo],
    )) as MachineSheetStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: {
        moldId: row.mold_id,
        moldNo: row.mold_no || '',
        stagesByTrial: sanitizeStagesByTrial(row.stages_by_trial),
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/machine-sheet-state error:', error);
    sendMachineSheetRouteError(res, 500, 'MACHINE_SHEET_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardMachineSheetState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendMachineSheetRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo } = readRequestIdentity(body);
  if (!moldId) {
    sendMachineSheetRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const stagesByTrial = sanitizeStagesByTrial(body.stagesByTrial);

  try {
    await ensureDashboardMachineSheetTable();

    if (Object.keys(stagesByTrial).length === 0) {
      await dbSql.unsafe(
        `DELETE FROM dashboard_machine_sheet_states WHERE mold_id = $1 AND mold_no = $2`,
        [moldId, moldNo],
      );
      res.status(200).json({ success: true });
      return;
    }

    await dbSql.unsafe(
      `
        INSERT INTO dashboard_machine_sheet_states (
          mold_id,
          mold_no,
          stages_by_trial,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no)
        DO UPDATE SET
          stages_by_trial = EXCLUDED.stages_by_trial,
          updated_at = NOW()
      `,
      [
        moldId,
        moldNo,
        JSON.stringify(stagesByTrial),
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/machine-sheet-state error:', error);
    sendMachineSheetRouteError(res, 500, 'MACHINE_SHEET_STATE_SAVE_FAILED');
  }
}
