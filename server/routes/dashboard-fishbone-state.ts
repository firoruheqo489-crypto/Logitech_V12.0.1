import type { Request, Response } from "express";

import { sql as dbSql } from "../db.js";

type FishboneBranch = "top" | "bottom";
type FishboneTemplateId = "manufacturing" | "software" | "blank";

type FishboneCause = {
  id: string;
  text: string;
};

type FishboneCategory = {
  id: string;
  title: string;
  titleEn: string;
  branch: FishboneBranch;
  causes: FishboneCause[];
};

type FishboneDiagramState = {
  templateId: FishboneTemplateId;
  problem: string;
  impact: string;
  rootCause: string;
  categories: FishboneCategory[];
};

type DashboardFishboneStateRow = {
  workspace_key: string;
  state_json: unknown;
  updated_at: string;
};

type DashboardFishboneRouteErrorCode =
  | "DATABASE_NOT_CONFIGURED"
  | "FISHBONE_STATE_DELETE_FAILED"
  | "FISHBONE_STATE_LOAD_FAILED"
  | "FISHBONE_STATE_SAVE_FAILED";

const DASHBOARD_FISHBONE_ROUTE_ERROR_MESSAGES: Record<DashboardFishboneRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: "Database not configured",
  FISHBONE_STATE_DELETE_FAILED: "Failed to delete dashboard fishbone state",
  FISHBONE_STATE_LOAD_FAILED: "Failed to load dashboard fishbone state",
  FISHBONE_STATE_SAVE_FAILED: "Failed to save dashboard fishbone state",
};

const DASHBOARD_FISHBONE_STATE_TABLE = "dashboard_fishbone_states_v1";
const DEFAULT_WORKSPACE_KEY = "dashboard-fishbone-workspace";
const TEMPLATE_IDS = new Set<FishboneTemplateId>(["manufacturing", "software", "blank"]);

let dashboardFishboneStateTableReady: Promise<void> | null = null;

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendDashboardFishboneRouteError(
  res: Response,
  status: number,
  code: DashboardFishboneRouteErrorCode,
): void {
  res.status(status).json({
    error: DASHBOARD_FISHBONE_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ""): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeWorkspaceKey(value: unknown): string {
  return normalizeText(value, 120, DEFAULT_WORKSPACE_KEY);
}

function sanitizeCause(value: unknown, fallbackId: string): FishboneCause | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    id: normalizeText(record.id, 120, fallbackId),
    text: normalizeText(record.text, 2000),
  };
}

function sanitizeCategory(value: unknown, fallbackId: string, fallbackTitle: string): FishboneCategory | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const causes = Array.isArray(record.causes)
    ? record.causes
        .map((cause, index) => sanitizeCause(cause, `${fallbackId}-cause-${index + 1}`))
        .filter((cause): cause is FishboneCause => cause !== null)
    : [];

  return {
    id: normalizeText(record.id, 120, fallbackId),
    title: normalizeText(record.title, 255, fallbackTitle),
    titleEn: normalizeText(record.titleEn, 255),
    branch: record.branch === "bottom" ? "bottom" : "top",
    causes,
  };
}

function sanitizeFishboneState(value: unknown): FishboneDiagramState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const categories = Array.isArray(record.categories)
    ? record.categories
        .map((category, index) =>
          sanitizeCategory(category, `category-${index + 1}`, `分类 ${index + 1}`),
        )
        .filter((category): category is FishboneCategory => category !== null)
    : [];

  if (categories.length === 0) {
    return null;
  }

  const templateId = normalizeText(record.templateId, 30, "manufacturing") as FishboneTemplateId;

  return {
    templateId: TEMPLATE_IDS.has(templateId) ? templateId : "manufacturing",
    problem: normalizeText(record.problem, 4000),
    impact: normalizeText(record.impact, 4000),
    rootCause: normalizeText(record.rootCause, 4000),
    categories,
  };
}

export function ensureDashboardFishboneStateTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardFishboneStateTableReady) {
    dashboardFishboneStateTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${DASHBOARD_FISHBONE_STATE_TABLE} (
          workspace_key VARCHAR(120) PRIMARY KEY,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  return dashboardFishboneStateTableReady;
}

export async function getDashboardFishboneState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  if (!dbSql) {
    sendDashboardFishboneRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey);

  try {
    await ensureDashboardFishboneStateTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT workspace_key, state_json, updated_at
        FROM ${DASHBOARD_FISHBONE_STATE_TABLE}
        WHERE workspace_key = $1
        LIMIT 1
      `,
      [workspaceKey],
    )) as DashboardFishboneStateRow[];

    const row = rows[0];
    const state = sanitizeFishboneState(row?.state_json);

    res.status(200).json({
      workspaceKey,
      state,
      updatedAt: normalizeText(row?.updated_at, 100),
    });
  } catch (error) {
    console.error("GET /api/dashboard/fishbone-state error:", error);
    sendDashboardFishboneRouteError(res, 500, "FISHBONE_STATE_LOAD_FAILED");
  }
}

export async function upsertDashboardFishboneState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardFishboneRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.body?.workspaceKey ?? req.query.workspaceKey);
  const state = sanitizeFishboneState(req.body?.state);
  if (!state) {
    sendDashboardFishboneRouteError(res, 400, "FISHBONE_STATE_SAVE_FAILED");
    return;
  }

  try {
    await ensureDashboardFishboneStateTable();
    const rows = (await dbSql.unsafe(
      `
        INSERT INTO ${DASHBOARD_FISHBONE_STATE_TABLE} (
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
    console.error("PUT /api/dashboard/fishbone-state error:", error);
    sendDashboardFishboneRouteError(res, 500, "FISHBONE_STATE_SAVE_FAILED");
  }
}

export async function deleteDashboardFishboneState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardFishboneRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey ?? req.body?.workspaceKey);

  try {
    await ensureDashboardFishboneStateTable();
    await dbSql.unsafe(
      `
        DELETE FROM ${DASHBOARD_FISHBONE_STATE_TABLE}
        WHERE workspace_key = $1
      `,
      [workspaceKey],
    );
    res.status(200).json({ ok: true, workspaceKey });
  } catch (error) {
    console.error("DELETE /api/dashboard/fishbone-state error:", error);
    sendDashboardFishboneRouteError(res, 500, "FISHBONE_STATE_DELETE_FAILED");
  }
}
