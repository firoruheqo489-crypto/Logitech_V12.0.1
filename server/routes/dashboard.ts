/**
 * Dashboard API — V1 看板项目数据 REST 化
 * 
 * 复用 V1 的 Drizzle schema (dashboard_projects 表)
 * 所有路由均为 public（无需认证）
 */

import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { db, sql as dbSql } from '../db.js';
import { dashboardProjects } from '../../shared/schema.js';

type DashboardProjectRow = typeof dashboardProjects.$inferSelect;

type DashboardHealthReport = {
  checkedAt: string;
  totalRows: number;
  uniqueMolds: number;
  duplicateMoldRows: number;
  emptyMoldRows: number;
  invalidUpdateDateRows: number;
  ok: boolean;
};

type DashboardModuleOrderRow = {
  project_name: string;
  sort_index: number;
};

type DashboardRouteErrorCode =
  | 'BODY_MUST_BE_ARRAY'
  | 'DATABASE_NOT_CONFIGURED'
  | 'HEALTH_CHECK_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'INVALID_ID'
  | 'NOT_FOUND';

const PINNED_HEAD_MODULE_NAMES = ['Ziti', 'Bioko -M'] as const;
const PINNED_TAIL_MODULE_NAMES = ['KIDDY'] as const;
const DASHBOARD_ROUTE_ERROR_MESSAGES: Record<DashboardRouteErrorCode, string> = {
  BODY_MUST_BE_ARRAY: 'request body must be an array',
  DATABASE_NOT_CONFIGURED: 'database not configured',
  HEALTH_CHECK_UNAVAILABLE: 'health check unavailable',
  INTERNAL_ERROR: 'internal server error',
  INVALID_ID: 'invalid id',
  NOT_FOUND: 'not found',
};

let dashboardHealthTableReady: Promise<void> | null = null;
let dashboardModuleOrderTableReady: Promise<void> | null = null;
const DASHBOARD_PROJECTS_CACHE_TTL_MS = 30_000;
let dashboardProjectsListCache: { expiresAt: number; rows: DashboardProjectRow[] } | null = null;
const DASHBOARD_DB_RETRY_MAX = 3;
const DASHBOARD_DB_RETRY_DELAY_MS = 600;

function sendDashboardRouteError(res: Response, status: number, code: DashboardRouteErrorCode): void {
  res.status(status).json({
    error: DASHBOARD_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorSignature(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) {
    const maybeWithCause = error as Error & { cause?: unknown; code?: unknown; errno?: unknown };
    return [
      error.name,
      String(error),
      typeof maybeWithCause.code === "string" ? maybeWithCause.code : "",
      typeof maybeWithCause.errno === "string" ? maybeWithCause.errno : "",
      maybeWithCause.cause ? getErrorSignature(maybeWithCause.cause) : "",
    ]
      .join(" ")
      .toUpperCase();
  }

  if (typeof error === "object") {
    const maybeRecord = error as Record<string, unknown>;
    return [
      typeof maybeRecord.code === "string" ? maybeRecord.code : "",
      typeof maybeRecord.errno === "string" ? maybeRecord.errno : "",
      String(error),
      "cause" in maybeRecord ? getErrorSignature(maybeRecord.cause) : "",
    ]
      .join(" ")
      .toUpperCase();
  }

  return String(error).toUpperCase();
}

function isRetryableDashboardDbError(error: unknown): boolean {
  const signature = getErrorSignature(error);
  return [
    "CONNECT_TIMEOUT",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "CONNECTION TERMINATED",
    "SOCKET HANG UP",
    "EPIPE",
  ].some((token) => signature.includes(token));
}

async function withDashboardDbRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DASHBOARD_DB_RETRY_MAX; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableDashboardDbError(error) || attempt === DASHBOARD_DB_RETRY_MAX) {
        throw error;
      }

      const delayMs = DASHBOARD_DB_RETRY_DELAY_MS * attempt;
      console.warn(`[dashboard-db-retry] ${label} attempt ${attempt} failed, retrying in ${delayMs}ms`, error);
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

function normalizeModuleName(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function readDashboardProjectsListCache(): DashboardProjectRow[] | null {
  if (!dashboardProjectsListCache || dashboardProjectsListCache.expiresAt <= Date.now()) {
    dashboardProjectsListCache = null;
    return null;
  }

  return dashboardProjectsListCache.rows;
}

function writeDashboardProjectsListCache(rows: DashboardProjectRow[]): void {
  dashboardProjectsListCache = {
    expiresAt: Date.now() + DASHBOARD_PROJECTS_CACHE_TTL_MS,
    rows,
  };
}

function invalidateDashboardProjectsListCache(): void {
  dashboardProjectsListCache = null;
}

function extractOrderedModuleNames(items: Array<Record<string, unknown>>): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const moduleName = String(item.projectName || '').trim();
    if (!moduleName) continue;
    const normalizedName = normalizeModuleName(moduleName);
    if (seen.has(normalizedName)) continue;
    seen.add(normalizedName);
    names.push(moduleName);
  }

  return names;
}

function buildNextModuleOrder(
  uploadModuleNames: string[],
  persistedModuleNames: string[],
): string[] {
  const uploadNameMap = new Map<string, string>();
  for (const moduleName of uploadModuleNames) {
    uploadNameMap.set(normalizeModuleName(moduleName), moduleName);
  }

  const activeNameSet = new Set(uploadNameMap.keys());
  const consumed = new Set<string>();
  const nextOrder: string[] = [];

  const pushName = (moduleName: string | undefined) => {
    if (!moduleName) return;
    const normalizedName = normalizeModuleName(moduleName);
    if (!normalizedName || consumed.has(normalizedName) || !activeNameSet.has(normalizedName)) return;
    nextOrder.push(uploadNameMap.get(normalizedName) || moduleName);
    consumed.add(normalizedName);
  };

  for (const moduleName of PINNED_HEAD_MODULE_NAMES) {
    pushName(moduleName);
  }

  for (const moduleName of persistedModuleNames) {
    pushName(moduleName);
  }

  for (const moduleName of uploadModuleNames) {
    pushName(moduleName);
  }

  for (const moduleName of PINNED_TAIL_MODULE_NAMES) {
    pushName(moduleName);
  }

  return nextOrder;
}

export function ensureDashboardHealthTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardHealthTableReady) {
    dashboardHealthTableReady = dbSql.unsafe(`
      CREATE TABLE IF NOT EXISTS dashboard_health_checks (
        id BIGSERIAL PRIMARY KEY,
        report JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
  }
  return dashboardHealthTableReady;
}

export function ensureDashboardModuleOrderTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardModuleOrderTableReady) {
    dashboardModuleOrderTableReady = dbSql.unsafe(`
      CREATE TABLE IF NOT EXISTS dashboard_module_order (
        project_name VARCHAR(255) PRIMARY KEY,
        sort_index INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);
  }
  return dashboardModuleOrderTableReady;
}

async function readDashboardModuleOrder(): Promise<DashboardModuleOrderRow[]> {
  if (!dbSql) return [];
  await ensureDashboardModuleOrderTable();
  const rows = await dbSql.unsafe(`
    SELECT project_name, sort_index
    FROM dashboard_module_order
    ORDER BY sort_index ASC, project_name ASC
  `);
  return rows as unknown as DashboardModuleOrderRow[];
}

async function syncDashboardModuleOrder(items: Array<Record<string, unknown>>): Promise<Map<string, number>> {
  if (!dbSql) return new Map();

  const uploadModuleNames = extractOrderedModuleNames(items);
  await ensureDashboardModuleOrderTable();
  const persistedRows = await readDashboardModuleOrder();
  const persistedNames = persistedRows.map((row) => row.project_name);
  const nextOrder = buildNextModuleOrder(uploadModuleNames, persistedNames);

  for (let index = 0; index < nextOrder.length; index += 1) {
    const moduleName = nextOrder[index];
    await dbSql.unsafe(
      `
        INSERT INTO dashboard_module_order (project_name, sort_index, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (project_name)
        DO UPDATE SET sort_index = EXCLUDED.sort_index, updated_at = NOW()
      `,
      [moduleName, index],
    );
  }

  return new Map(nextOrder.map((moduleName, index) => [normalizeModuleName(moduleName), index]));
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
  const dashboardDb = db;
  const rows = await withDashboardDbRetry('dashboard health check', () =>
    dashboardDb.select().from(dashboardProjects),
  );

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
  const dashboardDb = db;
  try {
    const cachedRows = readDashboardProjectsListCache();
    if (cachedRows) {
      res.setHeader('X-Dashboard-Cache', 'hit');
      res.json(cachedRows);
      return;
    }

    const rows = await withDashboardDbRetry('list dashboard projects', () =>
      dashboardDb.select().from(dashboardProjects).orderBy(asc(dashboardProjects.id)),
    );
    const moduleOrderRows = await withDashboardDbRetry('read dashboard module order', () =>
      readDashboardModuleOrder(),
    );
    const orderedModuleNames = buildNextModuleOrder(
      extractOrderedModuleNames(rows as Array<Record<string, unknown>>),
      moduleOrderRows.map((row) => row.project_name),
    );
    const moduleOrderMap = new Map(orderedModuleNames.map((moduleName, index) => [normalizeModuleName(moduleName), index]));
    const sortedRows = [...rows].sort((left, right) => {
      const leftOrder = moduleOrderMap.get(normalizeModuleName(left.projectName)) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = moduleOrderMap.get(normalizeModuleName(right.projectName)) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.id - right.id;
    });
    writeDashboardProjectsListCache(sortedRows);
    res.setHeader('X-Dashboard-Cache', 'miss');
    res.json(sortedRows);
  } catch (err) {
    console.error('GET /api/dashboard/projects error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** GET /api/dashboard/projects/:id */
export async function getDashboardProject(req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const dashboardDb = db;
  const id = Number(req.params.id);
  if (isNaN(id)) { sendDashboardRouteError(res, 400, 'INVALID_ID'); return; }
  try {
    const [row] = await withDashboardDbRetry('get dashboard project', () =>
      dashboardDb.select().from(dashboardProjects).where(eq(dashboardProjects.id, id)).limit(1),
    );
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
  const dashboardDb = db;
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
    await withDashboardDbRetry('sync dashboard module order before replace', () =>
      syncDashboardModuleOrder(normalizedItems),
    );
    const batchNow = new Date();
    await withDashboardDbRetry('batch replace dashboard projects', () =>
      dashboardDb.transaction(async (tx) => {
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
      }),
    );
    invalidateDashboardProjectsListCache();
    res.json({ success: true, count: normalizedItems.length });
  } catch (err) {
    console.error('POST /api/dashboard/projects/batch-replace error:', err);
    sendDashboardRouteError(res, 500, 'INTERNAL_ERROR');
  }
}

/** DELETE /api/dashboard/projects — 清空所有项目 */
export async function clearDashboardProjects(_req: Request, res: Response): Promise<void> {
  if (!db) { sendDashboardRouteError(res, 503, 'DATABASE_NOT_CONFIGURED'); return; }
  const dashboardDb = db;
  try {
    await withDashboardDbRetry('clear dashboard projects', () => dashboardDb.delete(dashboardProjects));
    invalidateDashboardProjectsListCache();
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
