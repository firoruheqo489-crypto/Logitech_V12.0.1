/**
 * Dashboard API — V1 看板项目数据 REST 化
 * 
 * 复用 V1 的 Drizzle schema (dashboard_projects 表)
 * 所有路由均为 public（无需认证）
 */

import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db, sql as dbSql } from '../db.js';
import { dashboardProjects } from '../../shared/schema.js';

type DashboardHealthReport = {
  checkedAt: string;
  totalRows: number;
  uniqueMolds: number;
  duplicateMoldRows: number;
  emptyMoldRows: number;
  invalidUpdateDateRows: number;
  ok: boolean;
};

type DashboardRouteErrorCode =
  | 'BODY_MUST_BE_ARRAY'
  | 'DATABASE_NOT_CONFIGURED'
  | 'HEALTH_CHECK_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'INVALID_ID'
  | 'NOT_FOUND';

const DASHBOARD_ROUTE_ERROR_MESSAGES: Record<DashboardRouteErrorCode, string> = {
  BODY_MUST_BE_ARRAY: 'request body must be an array',
  DATABASE_NOT_CONFIGURED: 'database not configured',
  HEALTH_CHECK_UNAVAILABLE: 'health check unavailable',
  INTERNAL_ERROR: 'internal server error',
  INVALID_ID: 'invalid id',
  NOT_FOUND: 'not found',
};

function sendDashboardRouteError(res: Response, status: number, code: DashboardRouteErrorCode): void {
  res.status(status).json({
    error: DASHBOARD_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

async function ensureDashboardHealthTable() {
  if (!dbSql) return;
  await dbSql.unsafe(`
    CREATE TABLE IF NOT EXISTS dashboard_health_checks (
      id BIGSERIAL PRIMARY KEY,
      report JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

function isLikelyValidDate(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return true;
  return /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.test(value);
}

export async function runDashboardHealthCheck(): Promise<DashboardHealthReport | null> {
  if (!db) return null;
  const rows = await db.select().from(dashboardProjects);

  const molds = rows
    .map((row) => String(row.moldId || '').trim())
    .filter((mold) => mold !== '');
  const uniqueMolds = new Set(molds);
  const duplicateMoldRows = Math.max(0, molds.length - uniqueMolds.size);
  const emptyMoldRows = rows.filter((row) => !String(row.moldId || '').trim()).length;
  const invalidUpdateDateRows = rows.filter((row) => {
    const updateDate = String(row.updateDate || '').trim();
    if (!updateDate) return false;
    return !isLikelyValidDate(updateDate);
  }).length;

  const report: DashboardHealthReport = {
    checkedAt: new Date().toISOString(),
    totalRows: rows.length,
    uniqueMolds: uniqueMolds.size,
    duplicateMoldRows,
    emptyMoldRows,
    invalidUpdateDateRows,
    ok: duplicateMoldRows === 0 && emptyMoldRows === 0 && invalidUpdateDateRows === 0,
  };

  if (dbSql) {
    await ensureDashboardHealthTable();
    await dbSql.unsafe(
      'INSERT INTO dashboard_health_checks (report) VALUES ($1::jsonb)',
      [JSON.stringify(report)],
    );
  }

  return report;
}

/** GET /api/dashboard/projects — 获取所有看板项目 */
export async function listDashboardProjects(_req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  try {
    const rows = await db.select().from(dashboardProjects);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/dashboard/projects error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/projects/:id */
export async function getDashboardProject(req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { sendDashboardRouteError(res, 400, 'INVALID_ID'); return; }
  try {
    const [row] = await db.select().from(dashboardProjects).where(eq(dashboardProjects.id, id)).limit(1);
    if (!row) { sendDashboardRouteError(res, 404, 'NOT_FOUND'); return; }
    res.json(row);
  } catch (err) {
    console.error('GET /api/dashboard/projects/:id error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** POST /api/dashboard/projects/batch-replace — 批量替换项目（保持每次上传为最新快照） */
export async function batchReplaceDashboardProjects(req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const items = req.body;
  if (!Array.isArray(items)) { sendDashboardRouteError(res, 400, 'BODY_MUST_BE_ARRAY'); return; }
  try {
    const dedupedByMold = new Map<string, Record<string, unknown>>();
    const noMoldItems: Record<string, unknown>[] = [];

    for (const rawItem of items) {
      const item = (rawItem || {}) as Record<string, unknown>;
      const moldId = String(item.moldId || '').trim();
      if (!moldId) {
        noMoldItems.push(item);
        continue;
      }
      dedupedByMold.set(moldId, item);
    }

    const normalizedItems = [...noMoldItems, ...Array.from(dedupedByMold.values())];
    const batchNow = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(dashboardProjects);
      if (normalizedItems.length > 0) {
        await tx.insert(dashboardProjects).values(
          normalizedItems.map((item) => ({
            ...(item || {}),
            createdAt: batchNow,
            updatedAt: batchNow,
          })),
        );
      }
    });
    res.json({ success: true, count: normalizedItems.length });
  } catch (err) {
    console.error('POST /api/dashboard/projects/batch-replace error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** DELETE /api/dashboard/projects — 清空所有项目 */
export async function clearDashboardProjects(_req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  try {
    await db.delete(dashboardProjects);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/dashboard/projects error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/health-check — 即时巡检结果 */
export async function getDashboardHealthCheck(_req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  try {
    const report = await runDashboardHealthCheck();
    if (!report) {
      sendDashboardRouteError(res, 503, 'HEALTH_CHECK_UNAVAILABLE');
      return;
    }
    res.json(report);
  } catch (err) {
    console.error('GET /api/dashboard/health-check error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/health-check/latest — 最近一次巡检 */
export async function getLatestDashboardHealthCheck(_req: Request, res: Response): Promise<void> {
  if (!dbSql) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  try {
    await ensureDashboardHealthTable();
    const rows = await dbSql.unsafe(
      'SELECT report, created_at FROM dashboard_health_checks ORDER BY created_at DESC, id DESC LIMIT 1',
    );
    if (!rows.length) {
      res.json({ report: null });
      return;
    }
    const row = rows[0] as unknown as { report: unknown; created_at: string };
    res.json({ report: row.report, createdAt: row.created_at });
  } catch (err) {
    console.error('GET /api/dashboard/health-check/latest error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}
