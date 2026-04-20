import type { Request, Response } from 'express';

import { sql as dbSql } from '../db.js';

type ParsedImage = {
  base64: string;
  mimeType: string;
  extension: string;
};

type ParsedCell = {
  text: string;
  images: ParsedImage[];
};

type ParseResult = {
  headers: string[];
  rows: ParsedCell[][];
  columnCount: number;
};

type DocxConverterStageState = {
  fileName: string | null;
  fileUrl: string | null;
  result: ParseResult | null;
};

type DocxConverterStateRow = {
  mold_id: string;
  mold_no: string;
  trial_stages: unknown;
  active_trial: string;
  stage_state_by_trial: unknown;
  updated_at: string;
};

type DocxConverterRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'DOCX_CONVERTER_STATE_DELETE_FAILED'
  | 'DOCX_CONVERTER_STATE_LOAD_FAILED'
  | 'DOCX_CONVERTER_STATE_SAVE_FAILED'
  | 'MOLD_ID_REQUIRED';

const DOCX_CONVERTER_ROUTE_ERROR_MESSAGES: Record<DocxConverterRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  DOCX_CONVERTER_STATE_DELETE_FAILED: 'Failed to delete docx converter state',
  DOCX_CONVERTER_STATE_LOAD_FAILED: 'Failed to load docx converter state',
  DOCX_CONVERTER_STATE_SAVE_FAILED: 'Failed to save docx converter state',
  MOLD_ID_REQUIRED: 'moldId is required',
};

const DOCX_CONVERTER_STATE_TABLE = 'dashboard_docx_converter_states_v1';
const DEFAULT_HEADERS = [
  'No.',
  'Issue Description',
  'Pictures',
  'Root Cause',
  'Solution',
  'Owner',
  'Due-Date',
  'Status',
  'Reference Link',
];
const DEFAULT_TRIAL_STAGES = ['T0', 'T1', 'T2', 'T3'];
const TRIAL_STAGE_PATTERN = /^T\d+$/;

let dashboardDocxConverterTableReady: Promise<void> | null = null;

function sendDocxConverterRouteError(
  res: Response,
  status: number,
  code: DocxConverterRouteErrorCode,
): void {
  res.status(status).json({
    error: DOCX_CONVERTER_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number): string | null {
  const text = normalizeText(value, maxLength);
  return text || null;
}

function normalizeTrialStage(value: unknown, fallback = ''): string {
  const text = normalizeText(value, 50, fallback).toUpperCase();
  if (text && TRIAL_STAGE_PATTERN.test(text)) {
    return text;
  }
  return fallback;
}

function sanitizeTrialStages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((stage) => normalizeTrialStage(stage))
        .filter((stage): stage is string => Boolean(stage)),
    ),
  ).sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));
}

function sanitizeImage(value: unknown): ParsedImage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const base64 = normalizeText(record.base64, 8_000_000);
  if (!base64) {
    return null;
  }

  return {
    base64,
    mimeType: normalizeText(record.mimeType, 120, 'image/png'),
    extension: normalizeText(record.extension, 20, 'png'),
  };
}

function sanitizeCell(value: unknown): ParsedCell {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { text: '', images: [] };
  }

  const record = value as Record<string, unknown>;
  const images = Array.isArray(record.images)
    ? record.images
        .map((image) => sanitizeImage(image))
        .filter((image): image is ParsedImage => image !== null)
    : [];

  return {
    text: normalizeText(record.text, 50_000),
    images,
  };
}

function sanitizeRow(value: unknown): ParsedCell[] {
  if (!Array.isArray(value)) {
    return Array.from({ length: 9 }, () => ({ text: '', images: [] }));
  }

  const row = value.slice(0, 9).map((cell) => sanitizeCell(cell));
  while (row.length < 9) {
    row.push({ text: '', images: [] });
  }
  return row;
}

function sanitizeHeaders(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_HEADERS];
  }

  const headers = value.slice(0, 9).map((header) => normalizeText(header, 200));
  while (headers.length < 9) {
    headers.push(DEFAULT_HEADERS[headers.length] || '');
  }
  return headers;
}

function sanitizeParseResult(value: unknown): ParseResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rows = Array.isArray(record.rows) ? record.rows.map((row) => sanitizeRow(row)) : [];
  const headers = sanitizeHeaders(record.headers);

  const hasAnyContent = rows.some((row) => row.some((cell) => cell.text.trim() || cell.images.length > 0));
  if (!hasAnyContent) {
    return null;
  }

  return {
    headers,
    rows,
    columnCount: 9,
  };
}

function hasStageContent(stageState: DocxConverterStageState): boolean {
  return Boolean(stageState.fileName || stageState.fileUrl || stageState.result);
}

function sanitizeStageState(value: unknown): DocxConverterStageState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const stageState: DocxConverterStageState = {
    fileName: normalizeOptionalText(record.fileName, 255),
    fileUrl: normalizeOptionalText(record.fileUrl, 4000),
    result: sanitizeParseResult(record.result),
  };

  if (!hasStageContent(stageState)) {
    return null;
  }

  return stageState;
}

function sanitizeStageStateByTrial(
  value: unknown,
  trialStages: string[],
): Record<string, DocxConverterStageState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const allowedTrialStages = new Set(trialStages);

  return Object.entries(value as Record<string, unknown>).reduce((acc, [stage, stageState]) => {
    const normalizedStage = normalizeTrialStage(stage);
    if (!normalizedStage || (allowedTrialStages.size > 0 && !allowedTrialStages.has(normalizedStage))) {
      return acc;
    }

    const sanitizedStageState = sanitizeStageState(stageState);
    if (!sanitizedStageState) {
      return acc;
    }

    acc[normalizedStage] = sanitizedStageState;
    return acc;
  }, {} as Record<string, DocxConverterStageState>);
}

function readRequestIdentity(source: Request['query'] | Record<string, unknown>) {
  const moldId = normalizeText(source.moldId, 100);
  const moldNo = normalizeText(source.moldNo, 100);
  return { moldId, moldNo };
}

function resolveTrialStages(
  incomingTrialStages: string[],
  stageStateByTrial: Record<string, DocxConverterStageState>,
  fallbackActiveTrial: string,
): string[] {
  if (incomingTrialStages.length > 0) {
    return incomingTrialStages;
  }

  const fromStageState = sanitizeTrialStages(Object.keys(stageStateByTrial));
  if (fromStageState.length > 0) {
    return fromStageState;
  }

  if (fallbackActiveTrial) {
    return [fallbackActiveTrial];
  }

  return [...DEFAULT_TRIAL_STAGES];
}

function normalizeActiveTrial(activeTrial: unknown, trialStages: string[]): string {
  const fallback = trialStages[0] || DEFAULT_TRIAL_STAGES[0];
  const normalized = normalizeTrialStage(activeTrial, fallback);
  if (trialStages.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

export function ensureDashboardDocxConverterTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();

  if (!dashboardDocxConverterTableReady) {
    dashboardDocxConverterTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS ${DOCX_CONVERTER_STATE_TABLE} (
          id BIGSERIAL PRIMARY KEY,
          mold_id VARCHAR(100) NOT NULL,
          mold_no VARCHAR(100) NOT NULL DEFAULT '',
          trial_stages JSONB NOT NULL DEFAULT '[]'::jsonb,
          active_trial VARCHAR(50) NOT NULL DEFAULT 'T0',
          stage_state_by_trial JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (mold_id, mold_no)
        )
      `);
    })();
  }

  return dashboardDocxConverterTableReady;
}

export async function getDashboardDocxConverterState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDocxConverterRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo } = readRequestIdentity(req.query);
  if (!moldId) {
    sendDocxConverterRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardDocxConverterTable();
    const rows = (await dbSql.unsafe(
      `
        SELECT mold_id, mold_no, trial_stages, active_trial, stage_state_by_trial, updated_at
        FROM ${DOCX_CONVERTER_STATE_TABLE}
        WHERE mold_id = $1 AND mold_no = $2
        LIMIT 1
      `,
      [moldId, moldNo],
    )) as DocxConverterStateRow[];

    const row = rows[0];
    if (!row) {
      res.status(200).json({ state: null });
      return;
    }

    const trialStages = resolveTrialStages(
      sanitizeTrialStages(row.trial_stages),
      sanitizeStageStateByTrial(row.stage_state_by_trial, []),
      normalizeTrialStage(row.active_trial, DEFAULT_TRIAL_STAGES[0]),
    );
    const stageStateByTrial = sanitizeStageStateByTrial(row.stage_state_by_trial, trialStages);

    res.status(200).json({
      state: {
        moldId: row.mold_id,
        moldNo: row.mold_no || '',
        trialStages,
        activeTrial: normalizeActiveTrial(row.active_trial, trialStages),
        stageStateByTrial,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('GET /api/dashboard/docx-converter-state error:', error);
    sendDocxConverterRouteError(res, 500, 'DOCX_CONVERTER_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardDocxConverterState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDocxConverterRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const { moldId, moldNo } = readRequestIdentity(body);
  if (!moldId) {
    sendDocxConverterRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  const incomingTrialStages = sanitizeTrialStages(body.trialStages);
  const incomingStageState = sanitizeStageStateByTrial(body.stageStateByTrial, []);
  const trialStages = resolveTrialStages(
    incomingTrialStages,
    incomingStageState,
    normalizeTrialStage(body.activeTrial, DEFAULT_TRIAL_STAGES[0]),
  );
  const activeTrial = normalizeActiveTrial(body.activeTrial, trialStages);
  const normalizedTrialStages = trialStages.includes(activeTrial)
    ? trialStages
    : [...trialStages, activeTrial].sort((a, b) => Number.parseInt(a.slice(1), 10) - Number.parseInt(b.slice(1), 10));
  const stageStateByTrial = sanitizeStageStateByTrial(incomingStageState, normalizedTrialStages);

  try {
    await ensureDashboardDocxConverterTable();

    if (normalizedTrialStages.length === 0 && Object.keys(stageStateByTrial).length === 0) {
      await dbSql.unsafe(
        `DELETE FROM ${DOCX_CONVERTER_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2`,
        [moldId, moldNo],
      );
      res.status(200).json({ success: true });
      return;
    }

    await dbSql.unsafe(
      `
        INSERT INTO ${DOCX_CONVERTER_STATE_TABLE} (
          mold_id,
          mold_no,
          trial_stages,
          active_trial,
          stage_state_by_trial,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, NOW(), NOW())
        ON CONFLICT (mold_id, mold_no)
        DO UPDATE SET
          trial_stages = EXCLUDED.trial_stages,
          active_trial = EXCLUDED.active_trial,
          stage_state_by_trial = EXCLUDED.stage_state_by_trial,
          updated_at = NOW()
      `,
      [
        moldId,
        moldNo,
        JSON.stringify(normalizedTrialStages),
        activeTrial,
        JSON.stringify(stageStateByTrial),
      ],
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PUT /api/dashboard/docx-converter-state error:', error);
    sendDocxConverterRouteError(res, 500, 'DOCX_CONVERTER_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardDocxConverterState(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendDocxConverterRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const { moldId, moldNo } = readRequestIdentity(req.query);
  if (!moldId) {
    sendDocxConverterRouteError(res, 400, 'MOLD_ID_REQUIRED');
    return;
  }

  try {
    await ensureDashboardDocxConverterTable();
    await dbSql.unsafe(
      `DELETE FROM ${DOCX_CONVERTER_STATE_TABLE} WHERE mold_id = $1 AND mold_no = $2`,
      [moldId, moldNo],
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/docx-converter-state error:', error);
    sendDocxConverterRouteError(res, 500, 'DOCX_CONVERTER_STATE_DELETE_FAILED');
  }
}
