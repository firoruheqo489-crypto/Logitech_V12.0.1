import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';

type Measurements = number[][][];
type StudyConfig = {
  operators: number;
  parts: number;
  trials: number;
  operatorNames: string[];
  partNames: string[];
  usl: number;
  lsl: number;
  historicalSigma?: number;
  alpha: number;
  measurements: Measurements;
};

type GrrStudyMeta = {
  partName: string;
  characteristic: string;
  gageId: string;
  date: string;
};

type GrrWorkspaceState = {
  version: 1;
  meta: GrrStudyMeta;
  cfg: StudyConfig;
};

type DashboardGrrStateRow = {
  workspace_key: string;
  state_json: unknown;
  updated_at: string;
};

type DashboardGrrRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'GRR_STATE_DELETE_FAILED'
  | 'GRR_STATE_LOAD_FAILED'
  | 'GRR_STATE_SAVE_FAILED';

const DASHBOARD_GRR_ROUTE_ERROR_MESSAGES: Record<DashboardGrrRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  GRR_STATE_DELETE_FAILED: 'Failed to delete dashboard GRR state',
  GRR_STATE_LOAD_FAILED: 'Failed to load dashboard GRR state',
  GRR_STATE_SAVE_FAILED: 'Failed to save dashboard GRR state',
};

const DASHBOARD_GRR_STATE_TABLE = 'dashboard_grr_states_v1';
const DEFAULT_WORKSPACE_KEY = 'dashboard-grr-workspace';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let dashboardGrrStateTableReady: Promise<void> | null = null;

function applyNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendDashboardGrrRouteError(res: Response, status: number, code: DashboardGrrRouteErrorCode): void {
  res.status(status).json({
    error: DASHBOARD_GRR_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeWorkspaceKey(value: unknown): string {
  return normalizeText(value, 120, DEFAULT_WORKSPACE_KEY);
}

function buildDefaultStudy(): StudyConfig {
  const operators = 3;
  const parts = 10;
  const trials = 3;
  const nominal = 25;
  const random = (() => {
    let state = 42;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const partTrue = Array.from({ length: parts }, (_, part) => nominal + (part - parts / 2) * 0.42);
  const operatorBias = Array.from({ length: operators }, (_, operator) => (operator - (operators - 1) / 2) * 0.045);

  return {
    operators,
    parts,
    trials,
    operatorNames: Array.from({ length: operators }, (_, index) => `APPRAISER ${LETTERS[index] ?? index + 1}`),
    partNames: Array.from({ length: parts }, (_, index) => `P${String(index + 1).padStart(2, '0')}`),
    usl: nominal + 2,
    lsl: nominal - 2,
    historicalSigma: 0,
    alpha: 0.05,
    measurements: Array.from({ length: operators }, (_, operator) =>
      Array.from({ length: parts }, (_, part) =>
        Array.from({ length: trials }, () => {
          const noise = (random() - 0.5) * 0.12;
          return +(partTrue[part] + operatorBias[operator] + noise).toFixed(3);
        }),
      ),
    ),
  };
}

function sanitizeGrrState(value: unknown): GrrWorkspaceState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const cfgInput = record.cfg;
  const metaInput = record.meta;
  if (!cfgInput || typeof cfgInput !== 'object' || Array.isArray(cfgInput)) {
    return null;
  }

  const cfgRecord = cfgInput as Record<string, unknown>;
  const fallback = buildDefaultStudy();
  const operators = Math.max(2, Math.min(8, Math.trunc(normalizeNumber(cfgRecord.operators, fallback.operators))));
  const parts = Math.max(2, Math.min(20, Math.trunc(normalizeNumber(cfgRecord.parts, fallback.parts))));
  const trials = Math.max(2, Math.min(7, Math.trunc(normalizeNumber(cfgRecord.trials, fallback.trials))));
  const measurementsInput = Array.isArray(cfgRecord.measurements) ? cfgRecord.measurements : [];

  const measurements: Measurements = Array.from({ length: operators }, (_, operator) =>
    Array.from({ length: parts }, (_, part) =>
      Array.from({ length: trials }, (_, trial) => {
        const candidatePart = (measurementsInput[operator] as unknown[] | undefined)?.[part];
        const candidateValue = (candidatePart as unknown[] | undefined)?.[trial];
        return normalizeNumber(candidateValue, fallback.measurements[0][0][0]);
      }),
    ),
  );

  const metaRecord =
    metaInput && typeof metaInput === 'object' && !Array.isArray(metaInput)
      ? (metaInput as Record<string, unknown>)
      : {};

  return {
    version: 1,
    meta: {
      partName: normalizeText(metaRecord.partName, 300),
      characteristic: normalizeText(metaRecord.characteristic, 300),
      gageId: normalizeText(metaRecord.gageId, 120),
      date: normalizeText(metaRecord.date, 40, new Date().toISOString().slice(0, 10)),
    },
    cfg: {
      operators,
      parts,
      trials,
      operatorNames: Array.from({ length: operators }, (_, index) => `APPRAISER ${LETTERS[index] ?? index + 1}`),
      partNames: Array.from({ length: parts }, (_, index) => `P${String(index + 1).padStart(2, '0')}`),
      usl: normalizeNumber(cfgRecord.usl, fallback.usl),
      lsl: normalizeNumber(cfgRecord.lsl, fallback.lsl),
      historicalSigma: Math.max(0, normalizeNumber(cfgRecord.historicalSigma, 0)),
      alpha: Math.min(0.5, Math.max(0.01, normalizeNumber(cfgRecord.alpha, fallback.alpha))),
      measurements,
    },
  };
}

export function ensureDashboardGrrStateTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardGrrStateTableReady) {
    dashboardGrrStateTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${DASHBOARD_GRR_STATE_TABLE} (
          workspace_key VARCHAR(120) PRIMARY KEY,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  return dashboardGrrStateTableReady;
}

export async function getDashboardGrrState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  if (!dbSql) {
    sendDashboardGrrRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey);

  try {
    await ensureDashboardGrrStateTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT workspace_key, state_json, updated_at
        FROM ${DASHBOARD_GRR_STATE_TABLE}
        WHERE workspace_key = $1
        LIMIT 1
      `,
      [workspaceKey],
    )) as DashboardGrrStateRow[];

    const row = rows[0];
    res.status(200).json({
      workspaceKey,
      state: sanitizeGrrState(row?.state_json),
      updatedAt: normalizeText(row?.updated_at, 100),
    });
  } catch (error) {
    console.error('GET /api/dashboard/grr-state error:', error);
    sendDashboardGrrRouteError(res, 500, 'GRR_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardGrrState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardGrrRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.body?.workspaceKey ?? req.query.workspaceKey);
  const state = sanitizeGrrState(req.body?.state);
  if (!state) {
    sendDashboardGrrRouteError(res, 400, 'GRR_STATE_SAVE_FAILED');
    return;
  }

  try {
    await ensureDashboardGrrStateTable();
    const rows = (await dbSql.unsafe(
      `
        INSERT INTO ${DASHBOARD_GRR_STATE_TABLE} (
          workspace_key,
          state_json,
          created_at,
          updated_at
        ) VALUES ($1, $2::jsonb, NOW(), NOW())
        ON CONFLICT (workspace_key)
        DO UPDATE SET
          state_json = EXCLUDED.state_json,
          updated_at = NOW()
        RETURNING updated_at
      `,
      [workspaceKey, JSON.stringify(state)],
    )) as Array<{ updated_at: string }>;

    res.status(200).json({
      ok: true,
      workspaceKey,
      updatedAt: normalizeText(rows[0]?.updated_at, 100),
    });
  } catch (error) {
    console.error('PUT /api/dashboard/grr-state error:', error);
    sendDashboardGrrRouteError(res, 500, 'GRR_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardGrrState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardGrrRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey ?? req.body?.workspaceKey);

  try {
    await ensureDashboardGrrStateTable();
    await dbSql.unsafe(
      `
        DELETE FROM ${DASHBOARD_GRR_STATE_TABLE}
        WHERE workspace_key = $1
      `,
      [workspaceKey],
    );
    res.status(200).json({ ok: true, workspaceKey });
  } catch (error) {
    console.error('DELETE /api/dashboard/grr-state error:', error);
    sendDashboardGrrRouteError(res, 500, 'GRR_STATE_DELETE_FAILED');
  }
}
