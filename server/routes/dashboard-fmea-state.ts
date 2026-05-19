import type { Request, Response } from 'express';

import { deleteOssObject, getOssObjectBuffer, putOssObject } from '../lib/oss.js';

export type FmeaModule = 'dfmea' | 'pfmea';
type FmeaHeaderFields = {
  projectName: string;
  partNumber: string;
  owner: string;
  reviewDate: string;
};

type DfmeaStatus = 'pending' | 'testing' | 'closed';
type DfmeaClass = 'CC' | 'SC' | 'STD';
type DfmeaRow = {
  id: string;
  systemId: string;
  process: string;
  mode: string;
  effect: string;
  classification: DfmeaClass;
  crossRisk: string;
  sev: number;
  cause: string;
  pc: string;
  occ: number;
  dc: string;
  det: number;
  rpn: number;
  dvprLinks: string[];
  action: string;
  ownerGate: string;
  status: DfmeaStatus;
};

type PfmeaStatus = 'pending' | 'testing' | 'closed';
type PfmeaVector = 'man' | 'machine' | 'material' | 'method' | 'environment';
type PfmeaPokaYoke = 'ccd' | 'sensor' | 'fixture' | 'visual' | 'program';
type PfmeaRow = {
  id: string;
  areaId: string;
  opCode: string;
  process: string;
  requirement: string;
  effect: string;
  sev: number;
  vector: PfmeaVector;
  cause: string;
  occ: number;
  pc: string;
  dc: string;
  pokaYoke: PfmeaPokaYoke;
  det: number;
  rpn: number;
  action: string;
  ownerGate: string;
  status: PfmeaStatus;
};

export type DfmeaWorkspaceState = {
  module: 'dfmea';
  workspaceKey: string;
  activeNodeId: string;
  headerFields: FmeaHeaderFields;
  tableData: DfmeaRow[];
  archiveCurrentDocumentId?: string | null;
  updatedAt?: string;
};

export type PfmeaWorkspaceState = {
  module: 'pfmea';
  workspaceKey: string;
  activeNodeId: string;
  headerFields: FmeaHeaderFields;
  tableData: PfmeaRow[];
  archiveCurrentDocumentId?: string | null;
  updatedAt?: string;
};

export type FmeaWorkspaceState = DfmeaWorkspaceState | PfmeaWorkspaceState;

type FmeaRouteErrorCode =
  | 'FMEA_STATE_DELETE_FAILED'
  | 'FMEA_STATE_LOAD_FAILED'
  | 'FMEA_STATE_SAVE_FAILED'
  | 'INVALID_FMEA_MODULE'
  | 'UPLOADS_NOT_CONFIGURED';

const FMEA_ROUTE_ERROR_MESSAGES: Record<FmeaRouteErrorCode, string> = {
  FMEA_STATE_DELETE_FAILED: 'Failed to delete FMEA state',
  FMEA_STATE_LOAD_FAILED: 'Failed to load FMEA state',
  FMEA_STATE_SAVE_FAILED: 'Failed to save FMEA state',
  INVALID_FMEA_MODULE: 'module must be dfmea or pfmea',
  UPLOADS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
};

export const DEFAULT_WORKSPACE_KEYS: Record<FmeaModule, string> = {
  dfmea: 'dashboard-dfmea-workspace',
  pfmea: 'dashboard-pfmea-workspace',
};

const FMEA_STATE_OBJECT_PREFIX = 'files/dashboard-fmea-states/v1';
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DFMEA_CLASS_SET = new Set<DfmeaClass>(['CC', 'SC', 'STD']);
const DFMEA_STATUS_SET = new Set<DfmeaStatus>(['pending', 'testing', 'closed']);
const PFMEA_STATUS_SET = new Set<PfmeaStatus>(['pending', 'testing', 'closed']);
const PFMEA_VECTOR_SET = new Set<PfmeaVector>(['man', 'machine', 'material', 'method', 'environment']);
const PFMEA_POKA_YOKE_SET = new Set<PfmeaPokaYoke>(['ccd', 'sensor', 'fixture', 'visual', 'program']);

function applyNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendFmeaRouteError(res: Response, status: number, code: FmeaRouteErrorCode): void {
  res.status(status).json({
    error: FMEA_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

export function normalizeText(value: unknown, maxLength: number, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

export function normalizeWorkspaceSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 120);

  return sanitized || 'workspace';
}

function normalizeIsoDate(value: unknown): string {
  const text = normalizeText(value, 10);
  return ISO_DATE_PATTERN.test(text) ? text : '';
}

function clampScore(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(1, Math.min(10, Math.round(numeric)));
}

export function readModule(value: unknown): FmeaModule | null {
  return value === 'pfmea' || value === 'dfmea' ? value : null;
}

export function readWorkspaceKey(source: Request['query'] | Record<string, unknown>, module: FmeaModule): string {
  return normalizeText(source.workspaceKey, 120, DEFAULT_WORKSPACE_KEYS[module]);
}

export function buildStateObjectKey(module: FmeaModule, workspaceKey: string): string {
  return `${FMEA_STATE_OBJECT_PREFIX}/${module}/${normalizeWorkspaceSegment(workspaceKey)}.json`;
}

export function isOssNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const record = error as { code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };
  return (
    record.code === 'NoSuchKey' ||
    record.name === 'NoSuchKeyError' ||
    record.status === 404 ||
    record.statusCode === 404
  );
}

export function isOssConfigError(error: unknown): boolean {
  return String(error ?? '').includes('ALIYUN_OSS_');
}

function sanitizeHeaderFields(value: unknown): FmeaHeaderFields {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    projectName: normalizeText(record.projectName, 255),
    partNumber: normalizeText(record.partNumber, 255),
    owner: normalizeText(record.owner, 255),
    reviewDate: normalizeIsoDate(record.reviewDate),
  };
}

function sanitizeStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => normalizeText(item, maxLength))
        .filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, maxItems);
}

function sanitizeDfmeaStatus(value: unknown): DfmeaStatus {
  const normalized = normalizeText(value, 20, 'pending').toLowerCase() as DfmeaStatus;
  return DFMEA_STATUS_SET.has(normalized) ? normalized : 'pending';
}

function sanitizeDfmeaClass(value: unknown): DfmeaClass {
  const normalized = normalizeText(value, 10, 'STD').toUpperCase() as DfmeaClass;
  return DFMEA_CLASS_SET.has(normalized) ? normalized : 'STD';
}

function sanitizeDfmeaRows(value: unknown): DfmeaRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    const sev = clampScore(record.sev, 5);
    const occ = clampScore(record.occ, 3);
    const det = clampScore(record.det, 3);

    return {
      id: normalizeText(record.id, 120, `dfmea-row-${index + 1}`),
      systemId: normalizeText(record.systemId, 120, 'lighting-root'),
      process: normalizeText(record.process, 255),
      mode: normalizeText(record.mode, 4000),
      effect: normalizeText(record.effect, 4000),
      classification: sanitizeDfmeaClass(record.classification),
      crossRisk: normalizeText(record.crossRisk, 4000),
      sev,
      cause: normalizeText(record.cause, 4000),
      pc: normalizeText(record.pc, 4000),
      occ,
      dc: normalizeText(record.dc, 4000),
      det,
      rpn: sev * occ * det,
      dvprLinks: sanitizeStringArray(record.dvprLinks, 20, 255),
      action: normalizeText(record.action, 4000),
      ownerGate: normalizeText(record.ownerGate, 255),
      status: sanitizeDfmeaStatus(record.status),
    } satisfies DfmeaRow;
  });
}

function sanitizePfmeaStatus(value: unknown): PfmeaStatus {
  const normalized = normalizeText(value, 20, 'pending').toLowerCase();
  if (normalized === 'in-progress') {
    return 'testing';
  }
  return PFMEA_STATUS_SET.has(normalized as PfmeaStatus) ? (normalized as PfmeaStatus) : 'pending';
}

function sanitizePfmeaVector(value: unknown): PfmeaVector {
  const normalized = normalizeText(value, 20, 'method').toLowerCase() as PfmeaVector;
  return PFMEA_VECTOR_SET.has(normalized) ? normalized : 'method';
}

function sanitizePfmeaPokaYoke(value: unknown): PfmeaPokaYoke {
  const normalized = normalizeText(value, 20, 'visual').toLowerCase() as PfmeaPokaYoke;
  return PFMEA_POKA_YOKE_SET.has(normalized) ? normalized : 'visual';
}

function sanitizePfmeaRows(value: unknown): PfmeaRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : {};
    const sev = clampScore(record.sev, 5);
    const occ = clampScore(record.occ, 3);
    const det = clampScore(record.det, 3);

    return {
      id: normalizeText(record.id, 120, `pfmea-row-${index + 1}`),
      areaId: normalizeText(record.areaId, 120, 'pfmea-root'),
      opCode: normalizeText(record.opCode, 40),
      process: normalizeText(record.process, 255),
      requirement: normalizeText(record.requirement, 4000),
      effect: normalizeText(record.effect, 4000),
      sev,
      vector: sanitizePfmeaVector(record.vector),
      cause: normalizeText(record.cause, 4000),
      occ,
      pc: normalizeText(record.pc, 4000),
      dc: normalizeText(record.dc, 4000),
      pokaYoke: sanitizePfmeaPokaYoke(record.pokaYoke),
      det,
      rpn: sev * occ * det,
      action: normalizeText(record.action, 4000),
      ownerGate: normalizeText(record.ownerGate, 255),
      status: sanitizePfmeaStatus(record.status),
    } satisfies PfmeaRow;
  });
}

function sanitizeDfmeaWorkspaceState(value: unknown, workspaceKey: string): DfmeaWorkspaceState {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    module: 'dfmea',
    workspaceKey,
    activeNodeId: normalizeText(record.activeNodeId, 120, 'lighting-root'),
    headerFields: sanitizeHeaderFields(record.headerFields),
    tableData: sanitizeDfmeaRows(record.tableData),
    archiveCurrentDocumentId: normalizeText(record.archiveCurrentDocumentId, 120) || null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

function sanitizePfmeaWorkspaceState(value: unknown, workspaceKey: string): PfmeaWorkspaceState {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return {
    module: 'pfmea',
    workspaceKey,
    activeNodeId: normalizeText(record.activeNodeId, 120, 'pfmea-root'),
    headerFields: sanitizeHeaderFields(record.headerFields),
    tableData: sanitizePfmeaRows(record.tableData),
    archiveCurrentDocumentId: normalizeText(record.archiveCurrentDocumentId, 120) || null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export function sanitizeWorkspaceState(
  module: FmeaModule,
  value: unknown,
  workspaceKey: string,
): FmeaWorkspaceState {
  return module === 'dfmea'
    ? sanitizeDfmeaWorkspaceState(value, workspaceKey)
    : sanitizePfmeaWorkspaceState(value, workspaceKey);
}

function readStoredState(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  return 'state' in record ? record.state : payload;
}

export async function getDashboardFmeaState(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  const module = readModule(req.query.module);
  if (!module) {
    sendFmeaRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query, module);

  try {
    const objectKey = buildStateObjectKey(module, workspaceKey);
    const buffer = await getOssObjectBuffer(objectKey);
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const storedState = sanitizeWorkspaceState(module, readStoredState(parsed), workspaceKey);
    const snapshotRecord =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const updatedAt = typeof snapshotRecord.updatedAt === 'string'
      ? snapshotRecord.updatedAt
      : storedState.updatedAt;

    res.status(200).json({
      state: {
        ...storedState,
        updatedAt,
      },
    });
  } catch (error) {
    if (isOssNotFoundError(error)) {
      res.status(200).json({ state: null });
      return;
    }

    console.error('GET /api/dashboard/fmea-state error:', error);
    sendFmeaRouteError(res, isOssConfigError(error) ? 503 : 500, isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_STATE_LOAD_FAILED');
  }
}

export async function upsertDashboardFmeaState(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const module = readModule(body.module);
  if (!module) {
    sendFmeaRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(body, module);
  const sanitizedState = sanitizeWorkspaceState(module, body, workspaceKey);
  const updatedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    module,
    workspaceKey,
    updatedAt,
    state: {
      ...sanitizedState,
      updatedAt,
    },
  };

  try {
    await putOssObject({
      objectKey: buildStateObjectKey(module, workspaceKey),
      body: Buffer.from(JSON.stringify(snapshot), 'utf8'),
      mimeType: 'application/json',
      cacheControl: 'no-cache',
    });

    res.status(200).json({ success: true, updatedAt });
  } catch (error) {
    console.error('PUT /api/dashboard/fmea-state error:', error);
    sendFmeaRouteError(res, isOssConfigError(error) ? 503 : 500, isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_STATE_SAVE_FAILED');
  }
}

export async function deleteDashboardFmeaState(req: Request, res: Response): Promise<void> {
  const module = readModule(req.query.module);
  if (!module) {
    sendFmeaRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query, module);

  try {
    await deleteOssObject(buildStateObjectKey(module, workspaceKey));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/fmea-state error:', error);
    sendFmeaRouteError(res, isOssConfigError(error) ? 503 : 500, isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_STATE_DELETE_FAILED');
  }
}
