import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';
import { deleteAssetFromOssUrl } from '../lib/oss.js';

type FaiDimensionRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'FAI_DIMENSION_STATE_LOAD_FAILED'
  | 'FAI_DIMENSION_STATE_SAVE_FAILED'
  | 'FAI_DIMENSION_STATE_DELETE_FAILED';

const FAI_DIMENSION_ROUTE_ERROR_MESSAGES: Record<FaiDimensionRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  FAI_DIMENSION_STATE_LOAD_FAILED: 'Failed to load FAI dimension state',
  FAI_DIMENSION_STATE_SAVE_FAILED: 'Failed to save FAI dimension state',
  FAI_DIMENSION_STATE_DELETE_FAILED: 'Failed to delete FAI dimension state',
};

const FAI_DIMENSION_STATE_TABLE = 'dashboard_fai_dimension_states_v1';
const DEFAULT_SCOPE = 'global';

type FaiDimensionStateRow = {
  scope: string;
  file_name: string | null;
  asset_url: string | null;
  selected_fai: string | null;
  updated_at: string;
};

let dashboardFaiDimensionTableReady: Promise<void> | null = null;

function sendFaiDimensionRouteError(res: Response, status: number, code: FaiDimensionRouteErrorCode): void {
  res.status(status).json({
    error: FAI_DIMENSION_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeScope(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return DEFAULT_SCOPE;
  return text
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 80) || DEFAULT_SCOPE;
}

function normalizeFileName(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 255) : null;
}

function normalizeAssetUrl(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, 4096) : null;
}

function normalizeSelectedFai(value: unknown): string {
  return String(value ?? '').trim().slice(0, 100);
}

export function ensureDashboardFaiDimensionTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardFaiDimensionTableReady) {
    dashboardFaiDimensionTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${FAI_DIMENSION_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          scope VARCHAR(80) NOT NULL UNIQUE,
          file_name VARCHAR(255),
          asset_url TEXT,
          selected_fai VARCHAR(100) NOT NULL DEFAULT '',
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  return dashboardFaiDimensionTableReady;
}

export async function getDashboardFaiDimensionState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendFaiDimensionRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const scope = normalizeScope(req.query.scope);

  try {
    await ensureDashboardFaiDimensionTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT scope, file_name, asset_url, selected_fai, updated_at
        FROM ${FAI_DIMENSION_STATE_TABLE}
        WHERE scope = $1
        LIMIT 1
      `,
      [scope],
    )) as FaiDimensionStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: {
        scope: row.scope,
        fileName: row.file_name || '',
        assetUrl: row.asset_url || '',
        selectedFai: row.selected_fai || '',
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/fai-dimension-state error:', error);
    sendFaiDimensionRouteError(res, 500, 'FAI_DIMENSION_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardFaiDimensionState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendFaiDimensionRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const scope = normalizeScope(body.scope);
  const fileName = normalizeFileName(body.fileName);
  const assetUrl = normalizeAssetUrl(body.assetUrl);
  const selectedFai = normalizeSelectedFai(body.selectedFai);

  try {
    await ensureDashboardFaiDimensionTable();
    const previousRows = (await dbSql.unsafe(
      `SELECT asset_url FROM ${FAI_DIMENSION_STATE_TABLE} WHERE scope = $1 LIMIT 1`,
      [scope],
    )) as Array<{ asset_url: string | null }>;

    await dbSql.unsafe(
      `
        INSERT INTO ${FAI_DIMENSION_STATE_TABLE} (
          scope,
          file_name,
          asset_url,
          selected_fai,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (scope)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          asset_url = EXCLUDED.asset_url,
          selected_fai = EXCLUDED.selected_fai,
          updated_at = NOW()
      `,
      [scope, fileName, assetUrl, selectedFai],
    );

    const previousAssetUrl = String(previousRows[0]?.asset_url ?? '').trim();
    if (previousAssetUrl && previousAssetUrl !== assetUrl) {
      await deleteAssetFromOssUrl(previousAssetUrl).catch(() => undefined);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/fai-dimension-state error:', error);
    sendFaiDimensionRouteError(res, 500, 'FAI_DIMENSION_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardFaiDimensionState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendFaiDimensionRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const scope = normalizeScope(req.query.scope);

  try {
    await ensureDashboardFaiDimensionTable();
    const rows = (await dbSql.unsafe(
      `SELECT asset_url FROM ${FAI_DIMENSION_STATE_TABLE} WHERE scope = $1 LIMIT 1`,
      [scope],
    )) as Array<{ asset_url: string | null }>;

    await dbSql.unsafe(
      `DELETE FROM ${FAI_DIMENSION_STATE_TABLE} WHERE scope = $1`,
      [scope],
    );

    const assetUrl = String(rows[0]?.asset_url ?? '').trim();
    if (assetUrl) {
      await deleteAssetFromOssUrl(assetUrl).catch(() => undefined);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/fai-dimension-state error:', error);
    sendFaiDimensionRouteError(res, 500, 'FAI_DIMENSION_STATE_DELETE_FAILED');
  }
}
