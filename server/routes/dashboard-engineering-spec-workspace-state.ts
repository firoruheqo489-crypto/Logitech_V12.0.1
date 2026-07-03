import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type EngineeringSpecWorkspaceStateRow = {
  workspace_key: string;
  payload_json: unknown;
  updated_at: string;
};

type EngineeringSpecWorkspaceRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'ENGINEERING_SPEC_WORKSPACE_STATE_LOAD_FAILED'
  | 'ENGINEERING_SPEC_WORKSPACE_STATE_SAVE_FAILED'
  | 'WORKSPACE_KEY_REQUIRED';

const ENGINEERING_SPEC_WORKSPACE_ROUTE_ERROR_MESSAGES: Record<
  EngineeringSpecWorkspaceRouteErrorCode,
  string
> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  ENGINEERING_SPEC_WORKSPACE_STATE_LOAD_FAILED: 'Failed to load engineering spec workspace state',
  ENGINEERING_SPEC_WORKSPACE_STATE_SAVE_FAILED: 'Failed to save engineering spec workspace state',
  WORKSPACE_KEY_REQUIRED: 'workspaceKey is required',
};

const ENGINEERING_SPEC_WORKSPACE_STATE_TABLE = 'dashboard_engineering_spec_workspace_states_v1';

let engineeringSpecWorkspaceTableReady: Promise<void> | null = null;

function sendRouteError(
  res: Response,
  status: number,
  code: EngineeringSpecWorkspaceRouteErrorCode,
): void {
  res.status(status).json({
    error: ENGINEERING_SPEC_WORKSPACE_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength = 255, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function sanitizeWorkspaceState(value: unknown, workspaceKeyFallback: string) {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      return null;
    }
  }

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  const record = source as Record<string, unknown>;
  return {
    workspaceKey: normalizeText(record.workspaceKey, 255, workspaceKeyFallback),
    sourceFileName: normalizeText(record.sourceFileName, 255),
    imageSrc: normalizeText(record.imageSrc, 8_000_000) || undefined,
    qeConclusion: normalizeText(record.qeConclusion, 12000) || undefined,
    inspectionTestProject:
      record.inspectionTestProject && typeof record.inspectionTestProject === 'object'
        ? {
            testType: normalizeText((record.inspectionTestProject as Record<string, unknown>).testType, 32) || undefined,
            sampleDeliveryDate:
              normalizeText((record.inspectionTestProject as Record<string, unknown>).sampleDeliveryDate, 64) || undefined,
            testItemCount:
              normalizeText((record.inspectionTestProject as Record<string, unknown>).testItemCount, 32) || undefined,
            remark: normalizeText((record.inspectionTestProject as Record<string, unknown>).remark, 4000) || undefined,
          }
        : undefined,
    oaInfo:
      record.oaInfo && typeof record.oaInfo === 'object'
        ? {
            workflowName: normalizeText((record.oaInfo as Record<string, unknown>).workflowName, 255) || undefined,
            workflowNo: normalizeText((record.oaInfo as Record<string, unknown>).workflowNo, 255) || undefined,
            reportStatus: normalizeText((record.oaInfo as Record<string, unknown>).reportStatus, 64) || undefined,
          }
        : undefined,
    metadata: record.metadata ?? {},
    header: record.header ?? {},
    packaging: Array.isArray(record.packaging) ? record.packaging : [],
    businessMeta: Array.isArray(record.businessMeta) ? record.businessMeta : [],
    sections: Array.isArray(record.sections) ? record.sections : [],
    evidenceSlots: Array.isArray(record.evidenceSlots) ? record.evidenceSlots : [],
  };
}

export function ensureDashboardEngineeringSpecWorkspaceTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!engineeringSpecWorkspaceTableReady) {
    engineeringSpecWorkspaceTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${ENGINEERING_SPEC_WORKSPACE_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          workspace_key VARCHAR(255) NOT NULL UNIQUE,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })();
  }

  return engineeringSpecWorkspaceTableReady;
}

export async function getDashboardEngineeringSpecWorkspaceState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const workspaceKey = normalizeText(req.query.workspaceKey, 255);
  if (!workspaceKey) {
    sendRouteError(res, 400, 'WORKSPACE_KEY_REQUIRED');
    return;
  }

  try {
    await ensureDashboardEngineeringSpecWorkspaceTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT workspace_key, payload_json, updated_at
        FROM ${ENGINEERING_SPEC_WORKSPACE_STATE_TABLE}
        WHERE workspace_key = $1
        LIMIT 1
      `,
      [workspaceKey],
    )) as EngineeringSpecWorkspaceStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    res.status(200).json({
      state: sanitizeWorkspaceState(row.payload_json, row.workspace_key),
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('GET /api/dashboard/engineering-spec-workspace-state error:', error);
    sendRouteError(res, 500, 'ENGINEERING_SPEC_WORKSPACE_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardEngineeringSpecWorkspaceState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const workspaceKey = normalizeText(body.workspaceKey, 255);
  if (!workspaceKey) {
    sendRouteError(res, 400, 'WORKSPACE_KEY_REQUIRED');
    return;
  }

  const payload = sanitizeWorkspaceState(body, workspaceKey);
  if (!payload) {
    sendRouteError(res, 500, 'ENGINEERING_SPEC_WORKSPACE_STATE_SAVE_FAILED');
    return;
  }

  try {
    await ensureDashboardEngineeringSpecWorkspaceTable();
    await dbSql.unsafe(
      `
        INSERT INTO ${ENGINEERING_SPEC_WORKSPACE_STATE_TABLE} (
          workspace_key,
          payload_json,
          created_at,
          updated_at
        ) VALUES ($1, $2::jsonb, NOW(), NOW())
        ON CONFLICT (workspace_key)
        DO UPDATE SET
          payload_json = EXCLUDED.payload_json,
          updated_at = NOW()
      `,
      [workspaceKey, JSON.stringify(payload)],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/engineering-spec-workspace-state error:', error);
    sendRouteError(res, 500, 'ENGINEERING_SPEC_WORKSPACE_STATE_SAVE_FAILED');
  }
}
