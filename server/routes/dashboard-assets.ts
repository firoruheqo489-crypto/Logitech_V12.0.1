import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';

const SLOT_TYPES = new Set(['product3d', 'product2d', 'productPhoto', 'mold3d', 'moldPhoto']);

type AssetRow = {
  mold_number: string;
  slot_type: string;
  image_url: string;
};

type DashboardAssetsRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'INVALID_ASSET_DELETE_REQUEST'
  | 'INVALID_ASSET_UPSERT_REQUEST'
  | 'PROJECT_ASSET_DELETE_FAILED'
  | 'PROJECT_ASSET_SAVE_FAILED'
  | 'PROJECT_ASSETS_LOAD_FAILED';

const DASHBOARD_ASSETS_ROUTE_ERROR_MESSAGES: Record<DashboardAssetsRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  INVALID_ASSET_DELETE_REQUEST: 'moldNumber and valid slotType are required',
  INVALID_ASSET_UPSERT_REQUEST: 'moldNumber, slotType and imageUrl are required',
  PROJECT_ASSET_DELETE_FAILED: 'Failed to delete project asset',
  PROJECT_ASSET_SAVE_FAILED: 'Failed to save project asset',
  PROJECT_ASSETS_LOAD_FAILED: 'Failed to load project assets',
};

let dashboardProjectAssetsTableReady: Promise<void> | null = null;

function sendDashboardAssetsRouteError(
  res: Response,
  status: number,
  code: DashboardAssetsRouteErrorCode,
): void {
  res.status(status).json({
    error: DASHBOARD_ASSETS_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

export function ensureDashboardProjectAssetsTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardProjectAssetsTableReady) {
    dashboardProjectAssetsTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS dashboard_project_assets (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          slot_type VARCHAR(50) NOT NULL,
          image_url VARCHAR(2048) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(mold_number, slot_type)
        )
      `);
    })();
  }
  return dashboardProjectAssetsTableReady;
}

function isValidSlotType(value: string): value is 'product3d' | 'product2d' | 'productPhoto' | 'mold3d' | 'moldPhoto' {
  return SLOT_TYPES.has(value);
}

export async function listDashboardProjectAssets(_req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardAssetsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureDashboardProjectAssetsTable();
    const rows = (await dbSql`
      SELECT mold_number, slot_type, image_url
      FROM dashboard_project_assets
      ORDER BY mold_number ASC, slot_type ASC
    `) as AssetRow[];

    const assetsByMold: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (!assetsByMold[row.mold_number]) {
        assetsByMold[row.mold_number] = {};
      }
      assetsByMold[row.mold_number][row.slot_type] = row.image_url;
    }

    res.status(200).json({ assetsByMold });
  } catch (err) {
    console.error('GET /api/dashboard/project-assets error:', err);
    sendDashboardAssetsRouteError(res, 500, 'PROJECT_ASSETS_LOAD_FAILED');
  }
}

export async function upsertDashboardProjectAsset(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardAssetsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldNumber = String(req.params.moldNumber || '').trim();
  const slotType = String(req.params.slotType || '').trim();
  const imageUrl = String((req.body as { imageUrl?: string })?.imageUrl || '').trim();

  if (!moldNumber || !isValidSlotType(slotType) || !imageUrl) {
    sendDashboardAssetsRouteError(res, 400, 'INVALID_ASSET_UPSERT_REQUEST');
    return;
  }

  try {
    await ensureDashboardProjectAssetsTable();
    await dbSql`
      INSERT INTO dashboard_project_assets (mold_number, slot_type, image_url, created_at, updated_at)
      VALUES (${moldNumber}, ${slotType}, ${imageUrl.slice(0, 2048)}, NOW(), NOW())
      ON CONFLICT (mold_number, slot_type)
      DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()
    `;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/dashboard/project-assets error:', err);
    sendDashboardAssetsRouteError(res, 500, 'PROJECT_ASSET_SAVE_FAILED');
  }
}

export async function deleteDashboardProjectAsset(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardAssetsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldNumber = String(req.params.moldNumber || '').trim();
  const slotType = String(req.params.slotType || '').trim();

  if (!moldNumber || !isValidSlotType(slotType)) {
    sendDashboardAssetsRouteError(res, 400, 'INVALID_ASSET_DELETE_REQUEST');
    return;
  }

  try {
    await ensureDashboardProjectAssetsTable();
    await dbSql`
      DELETE FROM dashboard_project_assets
      WHERE mold_number = ${moldNumber} AND slot_type = ${slotType}
    `;

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/dashboard/project-assets error:', err);
    sendDashboardAssetsRouteError(res, 500, 'PROJECT_ASSET_DELETE_FAILED');
  }
}
