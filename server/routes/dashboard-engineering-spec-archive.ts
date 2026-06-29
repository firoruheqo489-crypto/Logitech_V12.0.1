import type { Request, Response } from 'express';

import { getOssObjectBuffer, putOssObject } from '../lib/oss.js';
import { isOssConfigError, isOssNotFoundError } from './dashboard-fmea-state.js';

type EngineeringSpecArchiveProductInfo = {
  sku: string;
  spu: string;
  type: string;
  description: string;
  department: string;
  productGroup: string;
  sampleQty: string;
  testDate: string;
};

type EngineeringSpecArchiveState = {
  fileName: string;
  imageUrl?: string;
  qeConclusion?: string;
  images?: Array<{
    id: string;
    label: string;
    url: string;
  }>;
  packaging: Array<{ label: string; value: string }>;
  businessMeta: Array<{ label: string; value: string }>;
  productInfo: EngineeringSpecArchiveProductInfo;
  sections: Array<{
    label: string;
    groups: Array<{
      label: string;
      rows: Array<{
        item: string;
        label: string;
        value: string;
        pending: boolean;
        status?: 'pass' | 'fail' | 'untested';
      }>;
    }>;
  }>;
};

type EngineeringSpecLedgerRecord = {
  id: string;
  projectId: string;
  sequence: number;
  sku: string;
  spu: string;
  type: string;
  description: string;
  department: string;
  productGroup: string;
  sampleQty: string;
  testDate: string;
  result: '合格' | '待完善';
  pendingCount: number;
  createdAt: string;
  ossUrl: string;
};

type EngineeringSpecArchiveManifest = {
  schemaVersion: 1;
  projectId: string;
  updatedAt: string;
  documents: EngineeringSpecLedgerRecord[];
};

type EngineeringSpecArchiveSnapshot = {
  schemaVersion: 1;
  projectId: string;
  document: EngineeringSpecLedgerRecord;
  state: EngineeringSpecArchiveState;
};

type EngineeringSpecArchiveRouteErrorCode =
  | 'ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED'
  | 'ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED'
  | 'ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND'
  | 'ENGINEERING_SPEC_ARCHIVE_LIST_FAILED'
  | 'INVALID_ENGINEERING_SPEC_DOCUMENT_ID'
  | 'INVALID_ENGINEERING_SPEC_PROJECT_ID'
  | 'UPLOADS_NOT_CONFIGURED';

const ROUTE_ERROR_MESSAGES: Record<EngineeringSpecArchiveRouteErrorCode, string> = {
  ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED: 'Failed to create engineering spec archive',
  ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED: 'Failed to load engineering spec archive',
  ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND: 'Engineering spec archive not found',
  ENGINEERING_SPEC_ARCHIVE_LIST_FAILED: 'Failed to list engineering spec archives',
  INVALID_ENGINEERING_SPEC_DOCUMENT_ID: 'documentId is required',
  INVALID_ENGINEERING_SPEC_PROJECT_ID: 'projectId is required',
  UPLOADS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
};

const ENGINEERING_SPEC_ARCHIVE_OBJECT_PREFIX = 'files/dashboard-engineering-spec-archives/v1';

function applyNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendRouteError(
  res: Response,
  status: number,
  code: EngineeringSpecArchiveRouteErrorCode,
): void {
  res.status(status).json({
    error: ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function normalizeText(value: unknown, maxLength = 255, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function normalizeSegment(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .slice(0, 120) || 'default'
  );
}

function buildBasePrefix(projectId: string): string {
  return `${ENGINEERING_SPEC_ARCHIVE_OBJECT_PREFIX}/${normalizeSegment(projectId)}`;
}

function buildManifestObjectKey(projectId: string): string {
  return `${buildBasePrefix(projectId)}/manifest.json`;
}

function buildDocumentObjectKey(projectId: string, documentId: string): string {
  return `${buildBasePrefix(projectId)}/documents/${normalizeSegment(documentId)}.json`;
}

function readDocumentId(source: Request['query'] | Record<string, unknown>): string {
  return normalizeText(source.documentId, 120);
}

function sanitizeRecord(
  value: unknown,
  projectIdFallback: string,
  createdAtFallback: string,
): EngineeringSpecLedgerRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, 120);
  const sku = normalizeText(record.sku, 160);
  const ossUrl = normalizeText(record.ossUrl, 4000);
  if (!id || !sku || !ossUrl) return null;

  return {
    id,
    projectId: normalizeText(record.projectId, 255, projectIdFallback),
    sequence: Number(record.sequence) || 0,
    sku,
    spu: normalizeText(record.spu, 160),
    type: normalizeText(record.type, 255),
    description: normalizeText(record.description, 4000),
    department: normalizeText(record.department, 255),
    productGroup: normalizeText(record.productGroup, 255),
    sampleQty: normalizeText(record.sampleQty, 64),
    testDate: normalizeText(record.testDate, 64),
    result: normalizeText(record.result, 16) === '待完善' ? '待完善' : '合格',
    pendingCount: Number(record.pendingCount) || 0,
    createdAt: normalizeText(record.createdAt, 64, createdAtFallback),
    ossUrl,
  };
}

function sortDocumentsDescending(documents: EngineeringSpecLedgerRecord[]): EngineeringSpecLedgerRecord[] {
  return [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readManifest(projectId: string): Promise<EngineeringSpecArchiveManifest | null> {
  try {
    const buffer = await getOssObjectBuffer(buildManifestObjectKey(projectId));
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    const updatedAt = normalizeText(record.updatedAt, 64, new Date(0).toISOString());
    const documents = Array.isArray(record.documents)
      ? record.documents
          .map((item) => sanitizeRecord(item, projectId, updatedAt))
          .filter((item): item is EngineeringSpecLedgerRecord => Boolean(item))
      : [];

    return {
      schemaVersion: 1,
      projectId: normalizeText(record.projectId, 255, projectId),
      updatedAt,
      documents: sortDocumentsDescending(documents),
    };
  } catch (error) {
    if (isOssNotFoundError(error)) return null;
    throw error;
  }
}

async function writeManifest(projectId: string, documents: EngineeringSpecLedgerRecord[]): Promise<void> {
  const manifest: EngineeringSpecArchiveManifest = {
    schemaVersion: 1,
    projectId,
    updatedAt: new Date().toISOString(),
    documents: sortDocumentsDescending(documents),
  };

  await putOssObject({
    objectKey: buildManifestObjectKey(projectId),
    body: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'),
    mimeType: 'application/json',
    cacheControl: 'no-cache',
  });
}

async function readArchiveSnapshot(
  projectId: string,
  documentId: string,
): Promise<EngineeringSpecArchiveSnapshot | null> {
  try {
    const buffer = await getOssObjectBuffer(buildDocumentObjectKey(projectId, documentId));
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    const createdAt = normalizeText(record.createdAt, 64, new Date(0).toISOString());
    const document = sanitizeRecord(record.document, projectId, createdAt);
    if (!document) return null;

    return {
      schemaVersion: 1,
      projectId: normalizeText(record.projectId, 255, projectId),
      document,
      state: (record.state ?? {}) as EngineeringSpecArchiveState,
    };
  } catch (error) {
    if (isOssNotFoundError(error)) return null;
    throw error;
  }
}

export async function listDashboardEngineeringSpecArchives(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, 'INVALID_ENGINEERING_SPEC_PROJECT_ID');
    return;
  }

  try {
    const manifest = await readManifest(projectId);
    res.status(200).json({
      documents: manifest?.documents ?? [],
    });
  } catch (error) {
    console.error('GET /api/dashboard/engineering-spec-archives error:', error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'ENGINEERING_SPEC_ARCHIVE_LIST_FAILED',
    );
  }
}

export async function getDashboardEngineeringSpecArchiveDocument(req: Request, res: Response): Promise<void> {
  applyNoStoreHeaders(res);

  const projectId = normalizeText(req.query.projectId, 255);
  const documentId = readDocumentId(req.query);
  if (!projectId) {
    sendRouteError(res, 400, 'INVALID_ENGINEERING_SPEC_PROJECT_ID');
    return;
  }
  if (!documentId) {
    sendRouteError(res, 400, 'INVALID_ENGINEERING_SPEC_DOCUMENT_ID');
    return;
  }

  try {
    const snapshot = await readArchiveSnapshot(projectId, documentId);
    if (!snapshot) {
      sendRouteError(res, 404, 'ENGINEERING_SPEC_ARCHIVE_DOCUMENT_NOT_FOUND');
      return;
    }

    res.status(200).json({
      document: snapshot.document,
      state: snapshot.state,
    });
  } catch (error) {
    console.error('GET /api/dashboard/engineering-spec-archives/document error:', error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'ENGINEERING_SPEC_ARCHIVE_DOCUMENT_LOAD_FAILED',
    );
  }
}

export async function createDashboardEngineeringSpecArchive(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const projectId = normalizeText(body.projectId, 255);
  if (!projectId) {
    sendRouteError(res, 400, 'INVALID_ENGINEERING_SPEC_PROJECT_ID');
    return;
  }

  const state = (body.state || {}) as EngineeringSpecArchiveState;
  const createdAt = new Date().toISOString();
  const documentId = crypto.randomUUID();
  const documentObjectKey = buildDocumentObjectKey(projectId, documentId);
  const existingDocuments = (await readManifest(projectId))?.documents ?? [];
  const sequence = existingDocuments.length + 1;

  const pendingCount = (state.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter((row) => (row.status || 'untested') === 'untested').length,
        0,
      ),
    0,
  );
  const failCount = (state.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.groups || []).reduce(
        (groupTotal, group) =>
          groupTotal +
          (group.rows || []).filter((row) => (row.status || 'untested') === 'fail').length,
        0,
      ),
    0,
  );

  try {
    const provisionalRecord: EngineeringSpecLedgerRecord = {
      id: documentId,
      projectId,
      sequence,
      sku: normalizeText(state?.productInfo?.sku, 160, 'UNKNOWN-SKU'),
      spu: normalizeText(state?.productInfo?.spu, 160),
      type: normalizeText(state?.productInfo?.type, 255),
      description: normalizeText(state?.productInfo?.description, 4000),
      department: normalizeText(state?.productInfo?.department, 255),
      productGroup: normalizeText(state?.productInfo?.productGroup, 255),
      sampleQty: normalizeText(state?.productInfo?.sampleQty, 64),
      testDate: normalizeText(state?.productInfo?.testDate, 64),
      result: failCount > 0 || pendingCount > 0 ? '待完善' : '合格',
      pendingCount,
      createdAt,
      ossUrl: '',
    };

    const upload = await putOssObject({
      objectKey: documentObjectKey,
      body: Buffer.from(
        JSON.stringify(
          {
            schemaVersion: 1,
            projectId,
            document: provisionalRecord,
            state,
          } satisfies EngineeringSpecArchiveSnapshot,
          null,
          2,
        ),
        'utf8',
      ),
      mimeType: 'application/json',
      cacheControl: 'no-cache',
    });

    const storedRecord: EngineeringSpecLedgerRecord = {
      ...provisionalRecord,
      ossUrl: upload.url,
    };

    await putOssObject({
      objectKey: documentObjectKey,
      body: Buffer.from(
        JSON.stringify(
          {
            schemaVersion: 1,
            projectId,
            document: storedRecord,
            state,
          } satisfies EngineeringSpecArchiveSnapshot,
          null,
          2,
        ),
        'utf8',
      ),
      mimeType: 'application/json',
      cacheControl: 'no-cache',
    });

    await writeManifest(projectId, [
      storedRecord,
      ...existingDocuments.filter((item) => item.id !== documentId),
    ]);

    res.status(200).json({
      document: storedRecord,
    });
  } catch (error) {
    console.error('POST /api/dashboard/engineering-spec-archives error:', error);
    sendRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'ENGINEERING_SPEC_ARCHIVE_CREATE_FAILED',
    );
  }
}
