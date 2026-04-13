import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';
import { deleteAssetFromOssUrl } from '../lib/oss.js';

const SLOT_TYPES = new Set(['drawing-2d', 'measurement-method', 'product-standard'] as const);

type ProductDocSlotType = 'drawing-2d' | 'measurement-method' | 'product-standard';

type ProductDocRow = {
  mold_number: string;
  slot_type: string;
  file_url: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | string | null;
  created_at: string;
  updated_at: string;
};

type ProductDocRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'INVALID_PRODUCT_DOC_DELETE_REQUEST'
  | 'INVALID_PRODUCT_DOC_UPSERT_REQUEST'
  | 'PRODUCT_DOC_DELETE_FAILED'
  | 'PRODUCT_DOCS_LOAD_FAILED'
  | 'PRODUCT_DOC_SAVE_FAILED';

const PRODUCT_DOC_ROUTE_ERROR_MESSAGES: Record<ProductDocRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  INVALID_PRODUCT_DOC_DELETE_REQUEST: 'moldNumber and valid slotType are required',
  INVALID_PRODUCT_DOC_UPSERT_REQUEST: 'moldNumber, slotType, fileUrl and fileName are required',
  PRODUCT_DOC_DELETE_FAILED: 'Failed to delete product document',
  PRODUCT_DOCS_LOAD_FAILED: 'Failed to load product documents',
  PRODUCT_DOC_SAVE_FAILED: 'Failed to save product document',
};

let dashboardProductDocsTableReady: Promise<void> | null = null;

function sendProductDocRouteError(
  res: Response,
  status: number,
  code: ProductDocRouteErrorCode,
): void {
  res.status(status).json({
    error: PRODUCT_DOC_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeMoldLookupKey(value: string): string {
  const cleaned = String(value ?? '').trim().toUpperCase();
  if (!cleaned) return '';
  const digits = cleaned.replace(/[^0-9]/g, '');
  return digits || cleaned.replace(/[^A-Z0-9]/g, '');
}

function isValidSlotType(value: string): value is ProductDocSlotType {
  return SLOT_TYPES.has(value as ProductDocSlotType);
}

function readTextField(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function readNullableTextField(value: unknown, maxLength: number): string | null {
  const text = readTextField(value, maxLength);
  return text || null;
}

function readNumberField(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function logProductDocCleanupWarning(scope: string, error: unknown): void {
  console.warn(`[dashboard-product-docs] ${scope} cleanup failed:`, error);
}

export function ensureDashboardProductDocsTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardProductDocsTableReady) {
    dashboardProductDocsTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS dashboard_product_docs (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL,
          slot_type VARCHAR(50) NOT NULL,
          file_url VARCHAR(2048) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(120),
          file_size BIGINT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(mold_number, slot_type)
        )
      `);
    })();
  }

  return dashboardProductDocsTableReady;
}

export async function listDashboardProductDocs(_req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendProductDocRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureDashboardProductDocsTable();
    const rows = (await dbSql`
      SELECT
        mold_number,
        slot_type,
        file_url,
        file_name,
        mime_type,
        file_size,
        created_at,
        updated_at
      FROM dashboard_product_docs
      ORDER BY mold_number ASC, slot_type ASC
    `) as ProductDocRow[];

    res.status(200).json({ rows });
  } catch (err) {
    console.error('GET /api/dashboard/product-docs error:', err);
    sendProductDocRouteError(res, 500, 'PRODUCT_DOCS_LOAD_FAILED');
  }
}

export async function upsertDashboardProductDoc(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendProductDocRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldNumber = normalizeMoldLookupKey(String(req.params.moldNumber || ''));
  const slotType = String(req.params.slotType || '').trim();
  const body = (req.body || {}) as {
    fileUrl?: unknown;
    fileName?: unknown;
    mimeType?: unknown;
    fileSize?: unknown;
  };

  const fileUrl = readTextField(body.fileUrl, 2048);
  const fileName = readTextField(body.fileName, 255);
  const mimeType = readNullableTextField(body.mimeType, 120);
  const fileSize = readNumberField(body.fileSize);

  if (!moldNumber || !isValidSlotType(slotType) || !fileUrl || !fileName) {
    sendProductDocRouteError(res, 400, 'INVALID_PRODUCT_DOC_UPSERT_REQUEST');
    return;
  }

  try {
    await ensureDashboardProductDocsTable();
    const previousRows = (await dbSql`
      SELECT file_url
      FROM dashboard_product_docs
      WHERE mold_number = ${moldNumber} AND slot_type = ${slotType}
      LIMIT 1
    `) as Array<{ file_url: string }>;
    const previousFileUrl = String(previousRows[0]?.file_url || '').trim();

    await dbSql`
      INSERT INTO dashboard_product_docs (
        mold_number,
        slot_type,
        file_url,
        file_name,
        mime_type,
        file_size,
        created_at,
        updated_at
      )
      VALUES (
        ${moldNumber},
        ${slotType},
        ${fileUrl.slice(0, 2048)},
        ${fileName.slice(0, 255)},
        ${mimeType},
        ${fileSize},
        NOW(),
        NOW()
      )
      ON CONFLICT (mold_number, slot_type)
      DO UPDATE SET
        file_url = EXCLUDED.file_url,
        file_name = EXCLUDED.file_name,
        mime_type = EXCLUDED.mime_type,
        file_size = EXCLUDED.file_size,
        updated_at = NOW()
    `;

    if (previousFileUrl && previousFileUrl !== fileUrl) {
      try {
        await deleteAssetFromOssUrl(previousFileUrl);
      } catch (error) {
        logProductDocCleanupWarning(`${moldNumber}:${slotType}`, error);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('PATCH /api/dashboard/product-docs error:', err);
    sendProductDocRouteError(res, 500, 'PRODUCT_DOC_SAVE_FAILED');
  }
}

export async function deleteDashboardProductDoc(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendProductDocRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const moldNumber = normalizeMoldLookupKey(String(req.params.moldNumber || ''));
  const slotType = String(req.params.slotType || '').trim();

  if (!moldNumber || !isValidSlotType(slotType)) {
    sendProductDocRouteError(res, 400, 'INVALID_PRODUCT_DOC_DELETE_REQUEST');
    return;
  }

  try {
    await ensureDashboardProductDocsTable();
    const deletedRows = (await dbSql`
      DELETE FROM dashboard_product_docs
      WHERE mold_number = ${moldNumber} AND slot_type = ${slotType}
      RETURNING file_url
    `) as Array<{ file_url: string }>;

    const deletedFileUrl = String(deletedRows[0]?.file_url || '').trim();
    if (deletedFileUrl) {
      try {
        await deleteAssetFromOssUrl(deletedFileUrl);
      } catch (error) {
        logProductDocCleanupWarning(`${moldNumber}:${slotType}`, error);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('DELETE /api/dashboard/product-docs error:', err);
    sendProductDocRouteError(res, 500, 'PRODUCT_DOC_DELETE_FAILED');
  }
}
