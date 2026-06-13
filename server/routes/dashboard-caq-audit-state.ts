import type { Request, Response } from "express";

import { sql as dbSql } from "../db.js";

type RootCause =
  | "wrong-model"
  | "boundary-confusion"
  | "calculation-error"
  | "concept-blindspot"
  | "";

type AuditRecord = {
  id: string;
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: RootCause;
  action: string;
  timestamp: number;
};

type EditableState = {
  imageUrl: string | null;
  imageName: string | null;
  textParam: string;
  category: string;
  myLogic: string;
  correctAnswer: string;
  rootCause: RootCause;
  action: string;
};

type EditingSource = "record" | "draft" | null;

type PersistedWorkspaceState = EditableState & {
  editingId: string | null;
  editingSource: EditingSource;
  baselineSignature: string;
};

type CategoryTier = "鍩虹绡?" | "鍒嗘瀽绡?" | "搴旂敤绡?";

type CategoryOption = {
  value: string;
  label: string;
  tier: CategoryTier;
};

type DashboardCaqAuditRemoteState = {
  records: AuditRecord[];
  drafts: AuditRecord[];
  customCategories: CategoryOption[];
  workspace: PersistedWorkspaceState | null;
};

type DashboardCaqAuditStateRow = {
  workspace_key: string;
  state_json: unknown;
  updated_at: string;
};

type DashboardCaqAuditRouteErrorCode =
  | "DATABASE_NOT_CONFIGURED"
  | "CAQ_AUDIT_STATE_DELETE_FAILED"
  | "CAQ_AUDIT_STATE_LOAD_FAILED"
  | "CAQ_AUDIT_STATE_SAVE_FAILED";

const DASHBOARD_CAQ_AUDIT_ROUTE_ERROR_MESSAGES: Record<DashboardCaqAuditRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: "Database not configured",
  CAQ_AUDIT_STATE_DELETE_FAILED: "Failed to delete CAQ audit workspace state",
  CAQ_AUDIT_STATE_LOAD_FAILED: "Failed to load CAQ audit workspace state",
  CAQ_AUDIT_STATE_SAVE_FAILED: "Failed to save CAQ audit workspace state",
};

const DASHBOARD_CAQ_AUDIT_STATE_TABLE = "dashboard_caq_audit_states_v1";
const DEFAULT_WORKSPACE_KEY = "caq-audit-default";

let dashboardCaqAuditStateTableReady: Promise<void> | null = null;

function applyNoStoreHeaders(res: Response): void {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendDashboardCaqAuditRouteError(
  res: Response,
  status: number,
  code: DashboardCaqAuditRouteErrorCode,
): void {
  res.status(status).json({
    error: DASHBOARD_CAQ_AUDIT_ROUTE_ERROR_MESSAGES[code],
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

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  const text = normalizeText(value, maxLength);
  return text || null;
}

function sanitizeRootCause(value: unknown): RootCause {
  return value === "wrong-model" ||
    value === "boundary-confusion" ||
    value === "calculation-error" ||
    value === "concept-blindspot"
    ? value
    : "";
}

function sanitizeRecord(value: unknown): AuditRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const timestamp = Number(record.timestamp);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return {
    id: normalizeText(record.id, 120, `record-${timestamp}`),
    imageUrl: normalizeNullableText(record.imageUrl, 8_000_000),
    imageName: normalizeNullableText(record.imageName, 255),
    textParam: normalizeText(record.textParam, 50_000),
    category: normalizeText(record.category, 255),
    myLogic: normalizeText(record.myLogic, 50_000),
    correctAnswer: normalizeText(record.correctAnswer, 50_000),
    rootCause: sanitizeRootCause(record.rootCause),
    action: normalizeText(record.action, 50_000),
    timestamp,
  };
}

function sanitizeRecordList(value: unknown): AuditRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeRecord(item))
    .filter((item): item is AuditRecord => item !== null);
}

function sanitizeCategoryTier(value: unknown): CategoryTier {
  return value === "鍩虹绡?" || value === "鍒嗘瀽绡?" || value === "搴旂敤绡?" ? value : "搴旂敤绡?";
}

function sanitizeCategoryOption(value: unknown): CategoryOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const option = {
    value: normalizeText(record.value, 120),
    label: normalizeText(record.label, 255),
    tier: sanitizeCategoryTier(record.tier),
  };

  return option.value && option.label ? option : null;
}

function sanitizeCategoryOptions(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeCategoryOption(item))
    .filter((item): item is CategoryOption => item !== null);
}

function sanitizeWorkspaceState(value: unknown): PersistedWorkspaceState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    imageUrl: normalizeNullableText(record.imageUrl, 8_000_000),
    imageName: normalizeNullableText(record.imageName, 255),
    textParam: normalizeText(record.textParam, 50_000),
    category: normalizeText(record.category, 255),
    myLogic: normalizeText(record.myLogic, 50_000),
    correctAnswer: normalizeText(record.correctAnswer, 50_000),
    rootCause: sanitizeRootCause(record.rootCause),
    action: normalizeText(record.action, 50_000),
    editingId: normalizeNullableText(record.editingId, 120),
    editingSource: record.editingSource === "record" || record.editingSource === "draft" ? record.editingSource : null,
    baselineSignature: normalizeText(record.baselineSignature, 100_000, "{}"),
  };
}

function sanitizeRemoteState(value: unknown): DashboardCaqAuditRemoteState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      records: [],
      drafts: [],
      customCategories: [],
      workspace: null,
    };
  }

  const record = value as Record<string, unknown>;
  return {
    records: sanitizeRecordList(record.records),
    drafts: sanitizeRecordList(record.drafts),
    customCategories: sanitizeCategoryOptions(record.customCategories),
    workspace: sanitizeWorkspaceState(record.workspace),
  };
}

export function ensureDashboardCaqAuditStateTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardCaqAuditStateTableReady) {
    dashboardCaqAuditStateTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${DASHBOARD_CAQ_AUDIT_STATE_TABLE} (
          workspace_key VARCHAR(120) PRIMARY KEY,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  return dashboardCaqAuditStateTableReady;
}

export async function getDashboardCaqAuditState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  if (!dbSql) {
    sendDashboardCaqAuditRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey);

  try {
    await ensureDashboardCaqAuditStateTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT workspace_key, state_json, updated_at
        FROM ${DASHBOARD_CAQ_AUDIT_STATE_TABLE}
        WHERE workspace_key = $1
        LIMIT 1
      `,
      [workspaceKey],
    )) as DashboardCaqAuditStateRow[];

    const row = rows[0];
    const state = sanitizeRemoteState(row?.state_json);

    res.status(200).json({
      workspaceKey,
      state,
      updatedAt: normalizeText(row?.updated_at, 100),
    });
  } catch (error) {
    console.error("GET /api/dashboard/caq-audit-state error:", error);
    sendDashboardCaqAuditRouteError(res, 500, "CAQ_AUDIT_STATE_LOAD_FAILED");
  }
}

export async function upsertDashboardCaqAuditState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardCaqAuditRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.body?.workspaceKey ?? req.query.workspaceKey);
  const state = sanitizeRemoteState(req.body?.state);

  try {
    await ensureDashboardCaqAuditStateTable();
    const rows = (await dbSql.unsafe(
      `
        INSERT INTO ${DASHBOARD_CAQ_AUDIT_STATE_TABLE} (
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
    console.error("PUT /api/dashboard/caq-audit-state error:", error);
    sendDashboardCaqAuditRouteError(res, 500, "CAQ_AUDIT_STATE_SAVE_FAILED");
  }
}

export async function deleteDashboardCaqAuditState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDashboardCaqAuditRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const workspaceKey = normalizeWorkspaceKey(req.query.workspaceKey ?? req.body?.workspaceKey);

  try {
    await ensureDashboardCaqAuditStateTable();
    await dbSql.unsafe(
      `
        DELETE FROM ${DASHBOARD_CAQ_AUDIT_STATE_TABLE}
        WHERE workspace_key = $1
      `,
      [workspaceKey],
    );

    res.status(200).json({ ok: true, workspaceKey });
  } catch (error) {
    console.error("DELETE /api/dashboard/caq-audit-state error:", error);
    sendDashboardCaqAuditRouteError(res, 500, "CAQ_AUDIT_STATE_DELETE_FAILED");
  }
}
