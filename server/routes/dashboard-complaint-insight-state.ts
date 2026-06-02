import type { Request, Response } from "express";

import { sql as dbSql } from "../db.js";
import { deleteAssetFromOssUrl } from "../lib/oss.js";

type ComplaintInsightStateRouteErrorCode =
  | "DATABASE_NOT_CONFIGURED"
  | "COMPLAINT_INSIGHT_STATE_LOAD_FAILED"
  | "COMPLAINT_INSIGHT_STATE_SAVE_FAILED"
  | "COMPLAINT_INSIGHT_STATE_DELETE_FAILED"
  | "SOURCE_KEY_REQUIRED";

type SourceKey = "complaint" | "inspection" | "outsourcing";

type StoredComplaintInsightPayload = {
  sourceFile: string;
  sourceFiles?: string[];
  lastUpdated: string;
  rowCount: number;
  monthlySeries: unknown[];
  categoryBreakdown: unknown[];
  warnings: unknown[];
  rows: unknown[];
};

type ComplaintInsightStateRow = {
  source_key: SourceKey;
  source_file: string | null;
  asset_url: string | null;
  payload_json: unknown;
  updated_at: string;
};

const COMPLAINT_INSIGHT_STATE_ROUTE_ERROR_MESSAGES: Record<
  ComplaintInsightStateRouteErrorCode,
  string
> = {
  DATABASE_NOT_CONFIGURED: "Database not configured",
  COMPLAINT_INSIGHT_STATE_LOAD_FAILED: "Failed to load complaint insight state",
  COMPLAINT_INSIGHT_STATE_SAVE_FAILED: "Failed to save complaint insight state",
  COMPLAINT_INSIGHT_STATE_DELETE_FAILED: "Failed to delete complaint insight state",
  SOURCE_KEY_REQUIRED: "sourceKey is required",
};

const COMPLAINT_INSIGHT_STATE_TABLE = "dashboard_complaint_insight_states_v1";

let complaintInsightStateTableReady: Promise<void> | null = null;

function sendComplaintInsightStateRouteError(
  res: Response,
  status: number,
  code: ComplaintInsightStateRouteErrorCode
): void {
  res.status(status).json({
    error: COMPLAINT_INSIGHT_STATE_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ""): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeSourceKey(value: unknown): SourceKey | null {
  const key = normalizeText(value, 50);
  if (key === "complaint" || key === "inspection" || key === "outsourcing") {
    return key;
  }
  return null;
}

function sanitizePayload(value: unknown): StoredComplaintInsightPayload | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const sourceFile = normalizeText(record.sourceFile, 255);
  const lastUpdated = normalizeText(record.lastUpdated, 100);
  const rowCount = Number.isFinite(Number(record.rowCount)) ? Number(record.rowCount) : 0;
  const monthlySeries = Array.isArray(record.monthlySeries) ? record.monthlySeries : [];
  const categoryBreakdown = Array.isArray(record.categoryBreakdown) ? record.categoryBreakdown : [];
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];
  const rows = Array.isArray(record.rows) ? record.rows : [];
  const sourceFiles = Array.isArray(record.sourceFiles)
    ? record.sourceFiles.map((item) => normalizeText(item, 255)).filter(Boolean)
    : sourceFile
      ? [sourceFile]
      : [];

  if (!sourceFile || !lastUpdated) {
    return null;
  }

  return {
    sourceFile,
    sourceFiles,
    lastUpdated,
    rowCount,
    monthlySeries,
    categoryBreakdown,
    warnings,
    rows,
  };
}

function readSourceKeyFromRequest(req: Request): SourceKey | null {
  return normalizeSourceKey(req.params.sourceKey ?? req.query.sourceKey ?? req.body?.sourceKey);
}

export function ensureDashboardComplaintInsightStateTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!complaintInsightStateTableReady) {
    complaintInsightStateTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${COMPLAINT_INSIGHT_STATE_TABLE} (
          source_key VARCHAR(50) PRIMARY KEY,
          source_file VARCHAR(255),
          asset_url TEXT,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }
  return complaintInsightStateTableReady;
}

export async function getDashboardComplaintInsightState(
  _req: Request,
  res: Response
): Promise<void> {
  if (!dbSql) {
    sendComplaintInsightStateRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  try {
    await ensureDashboardComplaintInsightStateTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT source_key, source_file, asset_url, payload_json, updated_at
        FROM ${COMPLAINT_INSIGHT_STATE_TABLE}
      `
    )) as ComplaintInsightStateRow[];

    const state = {
      complaint: null,
      inspection: null,
      outsourcing: null,
    } as Record<SourceKey, { sourceFile: string; assetUrl: string; payload: StoredComplaintInsightPayload; updatedAt: string } | null>;

    rows.forEach((row) => {
      const sourceKey = normalizeSourceKey(row.source_key);
      const payload = sanitizePayload(row.payload_json);
      if (!sourceKey || !payload) return;

      state[sourceKey] = {
        sourceFile: normalizeText(row.source_file, 255),
        assetUrl: normalizeText(row.asset_url, 4000),
        payload,
        updatedAt: normalizeText(row.updated_at, 100),
      };
    });

    res.status(200).json({ state });
  } catch (error) {
    console.error("GET /api/dashboard/complaint-insight-state error:", error);
    sendComplaintInsightStateRouteError(res, 500, "COMPLAINT_INSIGHT_STATE_LOAD_FAILED");
  }
}

export async function upsertDashboardComplaintInsightState(
  req: Request,
  res: Response
): Promise<void> {
  if (!dbSql) {
    sendComplaintInsightStateRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const sourceKey = readSourceKeyFromRequest(req);
  if (!sourceKey) {
    sendComplaintInsightStateRouteError(res, 400, "SOURCE_KEY_REQUIRED");
    return;
  }

  const sourceFile = normalizeText(req.body?.sourceFile, 255);
  const assetUrl = normalizeText(req.body?.assetUrl, 4000);
  const payload = sanitizePayload(req.body?.payload);

  if (!sourceFile || !assetUrl || !payload) {
    sendComplaintInsightStateRouteError(res, 400, "COMPLAINT_INSIGHT_STATE_SAVE_FAILED");
    return;
  }

  try {
    await ensureDashboardComplaintInsightStateTable();

    const existingRows = (await dbSql.unsafe(
      `
        SELECT asset_url
        FROM ${COMPLAINT_INSIGHT_STATE_TABLE}
        WHERE source_key = $1
        LIMIT 1
      `,
      [sourceKey]
    )) as Array<{ asset_url: string | null }>;

    const existingAssetUrl = normalizeText(existingRows[0]?.asset_url, 4000);

    await dbSql.unsafe(
      `
        INSERT INTO ${COMPLAINT_INSIGHT_STATE_TABLE} (
          source_key,
          source_file,
          asset_url,
          payload_json,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
        ON CONFLICT (source_key)
        DO UPDATE SET
          source_file = EXCLUDED.source_file,
          asset_url = EXCLUDED.asset_url,
          payload_json = EXCLUDED.payload_json,
          updated_at = NOW()
      `,
      [sourceKey, sourceFile, assetUrl, JSON.stringify(payload)]
    );

    if (existingAssetUrl && existingAssetUrl !== assetUrl) {
      await deleteAssetFromOssUrl(existingAssetUrl).catch((error) => {
        console.warn("Failed to cleanup previous complaint insight asset:", error);
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("PUT /api/dashboard/complaint-insight-state error:", error);
    sendComplaintInsightStateRouteError(res, 500, "COMPLAINT_INSIGHT_STATE_SAVE_FAILED");
  }
}

export async function deleteDashboardComplaintInsightState(
  req: Request,
  res: Response
): Promise<void> {
  if (!dbSql) {
    sendComplaintInsightStateRouteError(res, 503, "DATABASE_NOT_CONFIGURED");
    return;
  }

  const sourceKey = readSourceKeyFromRequest(req);
  if (!sourceKey) {
    sendComplaintInsightStateRouteError(res, 400, "SOURCE_KEY_REQUIRED");
    return;
  }

  try {
    await ensureDashboardComplaintInsightStateTable();

    const existingRows = (await dbSql.unsafe(
      `
        SELECT asset_url
        FROM ${COMPLAINT_INSIGHT_STATE_TABLE}
        WHERE source_key = $1
        LIMIT 1
      `,
      [sourceKey]
    )) as Array<{ asset_url: string | null }>;

    const existingAssetUrl = normalizeText(existingRows[0]?.asset_url, 4000);

    await dbSql.unsafe(
      `DELETE FROM ${COMPLAINT_INSIGHT_STATE_TABLE} WHERE source_key = $1`,
      [sourceKey]
    );

    if (existingAssetUrl) {
      await deleteAssetFromOssUrl(existingAssetUrl).catch((error) => {
        console.warn("Failed to delete complaint insight OSS asset:", error);
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("DELETE /api/dashboard/complaint-insight-state error:", error);
    sendComplaintInsightStateRouteError(res, 500, "COMPLAINT_INSIGHT_STATE_DELETE_FAILED");
  }
}
