import type { Request, Response } from 'express';

import { deleteOssObject, getOssObjectBuffer, putOssObject } from '../lib/oss.js';
import {
  DEFAULT_WORKSPACE_KEYS,
  buildStateObjectKey,
  isOssConfigError,
  isOssNotFoundError,
  normalizeText,
  normalizeWorkspaceSegment,
  readModule,
  readWorkspaceKey,
  sanitizeWorkspaceState,
  type FmeaModule,
  type FmeaWorkspaceState,
} from './dashboard-fmea-state.js';

type FmeaDocument = {
  id: string;
  projectId: string;
  version: string;
  createdAt: string;
  ossUrl: string;
  isCurrent: boolean;
};

type StoredFmeaDocument = Omit<FmeaDocument, 'isCurrent'>;

type FmeaArchiveManifest = {
  schemaVersion: 1;
  module: FmeaModule;
  projectId: string;
  updatedAt: string;
  documents: StoredFmeaDocument[];
};

type FmeaArchiveSnapshot = {
  schemaVersion: 1;
  module: FmeaModule;
  projectId: string;
  document: StoredFmeaDocument;
  state: FmeaWorkspaceState;
};

type FmeaArchiveRouteErrorCode =
  | 'CURRENT_FMEA_ARCHIVE_DELETE_FORBIDDEN'
  | 'FMEA_ARCHIVE_CREATE_FAILED'
  | 'FMEA_ARCHIVE_DELETE_FAILED'
  | 'FMEA_ARCHIVE_DOCUMENT_LOAD_FAILED'
  | 'FMEA_ARCHIVE_DOCUMENT_NOT_FOUND'
  | 'FMEA_ARCHIVE_LIST_FAILED'
  | 'INVALID_FMEA_ARCHIVE_DOCUMENT_ID'
  | 'INVALID_FMEA_ARCHIVE_PROJECT_ID'
  | 'INVALID_FMEA_ARCHIVE_VERSION'
  | 'INVALID_FMEA_MODULE'
  | 'UPLOADS_NOT_CONFIGURED';

const FMEA_ARCHIVE_ROUTE_ERROR_MESSAGES: Record<FmeaArchiveRouteErrorCode, string> = {
  CURRENT_FMEA_ARCHIVE_DELETE_FORBIDDEN: 'Cannot delete the active FMEA archive version',
  FMEA_ARCHIVE_CREATE_FAILED: 'Failed to create FMEA archive version',
  FMEA_ARCHIVE_DELETE_FAILED: 'Failed to delete FMEA archive version',
  FMEA_ARCHIVE_DOCUMENT_LOAD_FAILED: 'Failed to load FMEA archive version',
  FMEA_ARCHIVE_DOCUMENT_NOT_FOUND: 'FMEA archive version not found',
  FMEA_ARCHIVE_LIST_FAILED: 'Failed to list FMEA archive versions',
  INVALID_FMEA_ARCHIVE_DOCUMENT_ID: 'documentId is required',
  INVALID_FMEA_ARCHIVE_PROJECT_ID: 'projectId is required',
  INVALID_FMEA_ARCHIVE_VERSION: 'version is required',
  INVALID_FMEA_MODULE: 'module must be dfmea or pfmea',
  UPLOADS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
};

const FMEA_ARCHIVE_OBJECT_PREFIX = 'files/dashboard-fmea-archives/v1';

function applyNoStoreHeaders(res: Response): void {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendFmeaArchiveRouteError(
  res: Response,
  status: number,
  code: FmeaArchiveRouteErrorCode,
): void {
  res.status(status).json({
    error: FMEA_ARCHIVE_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function readProjectId(
  source: Request['query'] | Record<string, unknown>,
  module: FmeaModule,
  workspaceKey = DEFAULT_WORKSPACE_KEYS[module],
): string {
  return normalizeText(source.projectId, 255, workspaceKey);
}

function readVersion(value: unknown): string {
  return normalizeText(value, 160);
}

function readDocumentId(source: Request['query'] | Record<string, unknown>): string {
  return normalizeText(source.documentId, 120);
}

function buildArchiveBasePrefix(module: FmeaModule, projectId: string): string {
  return `${FMEA_ARCHIVE_OBJECT_PREFIX}/${module}/${normalizeWorkspaceSegment(projectId)}`;
}

function buildArchiveManifestObjectKey(module: FmeaModule, projectId: string): string {
  return `${buildArchiveBasePrefix(module, projectId)}/manifest.json`;
}

function buildArchiveDocumentObjectKey(
  module: FmeaModule,
  projectId: string,
  documentId: string,
): string {
  return `${buildArchiveBasePrefix(module, projectId)}/documents/${normalizeWorkspaceSegment(documentId)}.json`;
}

function sortDocumentsDescending(documents: StoredFmeaDocument[]): StoredFmeaDocument[] {
  return [...documents].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);

    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function mapDocuments(documents: StoredFmeaDocument[], currentDocumentId: string | null): FmeaDocument[] {
  return documents.map((document) => ({
    ...document,
    isCurrent: Boolean(currentDocumentId) && document.id === currentDocumentId,
  }));
}

function readArchivePayloadState(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  return 'state' in record ? record.state : payload;
}

function sanitizeStoredDocument(
  value: unknown,
  projectIdFallback: string,
  createdAtFallback: string,
): StoredFmeaDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = normalizeText(record.id, 120);
  const version = normalizeText(record.version, 160);
  const ossUrl = normalizeText(record.ossUrl, 4000);

  if (!id || !version || !ossUrl) {
    return null;
  }

  return {
    id,
    projectId: normalizeText(record.projectId, 255, projectIdFallback),
    version,
    createdAt: normalizeText(record.createdAt, 64, createdAtFallback),
    ossUrl,
  };
}

function sanitizeManifest(
  module: FmeaModule,
  projectId: string,
  value: unknown,
): FmeaArchiveManifest {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const updatedAt = normalizeText(record.updatedAt, 64, new Date(0).toISOString());
  const documents = Array.isArray(record.documents)
    ? record.documents
        .map((item) => sanitizeStoredDocument(item, projectId, updatedAt))
        .filter((item): item is StoredFmeaDocument => Boolean(item))
    : [];

  return {
    schemaVersion: 1,
    module,
    projectId: normalizeText(record.projectId, 255, projectId),
    updatedAt,
    documents: sortDocumentsDescending(documents),
  };
}

async function readManifest(
  module: FmeaModule,
  projectId: string,
): Promise<FmeaArchiveManifest | null> {
  try {
    const buffer = await getOssObjectBuffer(buildArchiveManifestObjectKey(module, projectId));
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    return sanitizeManifest(module, projectId, parsed);
  } catch (error) {
    if (isOssNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function writeManifest(
  module: FmeaModule,
  projectId: string,
  documents: StoredFmeaDocument[],
): Promise<void> {
  const manifest: FmeaArchiveManifest = {
    schemaVersion: 1,
    module,
    projectId,
    updatedAt: new Date().toISOString(),
    documents: sortDocumentsDescending(documents),
  };

  await putOssObject({
    objectKey: buildArchiveManifestObjectKey(module, projectId),
    body: Buffer.from(JSON.stringify(manifest), 'utf8'),
    mimeType: 'application/json',
    cacheControl: 'no-cache',
  });
}

async function readCurrentWorkspaceDocumentId(
  module: FmeaModule,
  workspaceKey: string,
): Promise<string | null> {
  try {
    const buffer = await getOssObjectBuffer(buildStateObjectKey(module, workspaceKey));
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const state = sanitizeWorkspaceState(module, readArchivePayloadState(parsed), workspaceKey);
    return normalizeText(state.archiveCurrentDocumentId, 120) || null;
  } catch (error) {
    if (isOssNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function readArchiveSnapshot(
  module: FmeaModule,
  projectId: string,
  documentId: string,
): Promise<FmeaArchiveSnapshot | null> {
  try {
    const buffer = await getOssObjectBuffer(buildArchiveDocumentObjectKey(module, projectId, documentId));
    const parsed = JSON.parse(buffer.toString('utf8')) as unknown;
    const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
    const document = sanitizeStoredDocument(record.document, projectId, new Date(0).toISOString());

    if (!document) {
      return null;
    }

    return {
      schemaVersion: 1,
      module,
      projectId: normalizeText(record.projectId, 255, projectId),
      document,
      state: sanitizeWorkspaceState(module, readArchivePayloadState(record.state), DEFAULT_WORKSPACE_KEYS[module]),
    };
  } catch (error) {
    if (isOssNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function listDashboardFmeaArchiveDocuments(
  req: Request,
  res: Response,
): Promise<void> {
  applyNoStoreHeaders(res);

  const module = readModule(req.query.module);
  if (!module) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query, module);
  const projectId = readProjectId(req.query, module, workspaceKey);

  if (!projectId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_PROJECT_ID');
    return;
  }

  try {
    const [manifest, currentDocumentId] = await Promise.all([
      readManifest(module, projectId),
      readCurrentWorkspaceDocumentId(module, workspaceKey),
    ]);

    res.status(200).json({
      documents: mapDocuments(manifest?.documents ?? [], currentDocumentId),
    });
  } catch (error) {
    console.error('GET /api/dashboard/fmea-archives error:', error);
    sendFmeaArchiveRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_ARCHIVE_LIST_FAILED',
    );
  }
}

export async function getDashboardFmeaArchiveDocument(
  req: Request,
  res: Response,
): Promise<void> {
  applyNoStoreHeaders(res);

  const module = readModule(req.query.module);
  if (!module) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const projectId = readProjectId(req.query, module);
  const documentId = readDocumentId(req.query);

  if (!projectId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_PROJECT_ID');
    return;
  }

  if (!documentId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_DOCUMENT_ID');
    return;
  }

  try {
    const snapshot = await readArchiveSnapshot(module, projectId, documentId);

    if (!snapshot) {
      sendFmeaArchiveRouteError(res, 404, 'FMEA_ARCHIVE_DOCUMENT_NOT_FOUND');
      return;
    }

    res.status(200).json({
      document: {
        ...snapshot.document,
        isCurrent: false,
      } satisfies FmeaDocument,
      state: snapshot.state,
    });
  } catch (error) {
    console.error('GET /api/dashboard/fmea-archives/document error:', error);
    sendFmeaArchiveRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_ARCHIVE_DOCUMENT_LOAD_FAILED',
    );
  }
}

export async function createDashboardFmeaArchiveDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const module = readModule(body.module);

  if (!module) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(body, module);
  const projectId = readProjectId(body, module, workspaceKey);
  const version = readVersion(body.version);

  if (!projectId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_PROJECT_ID');
    return;
  }

  if (!version) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_VERSION');
    return;
  }

  const documentId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const documentObjectKey = buildArchiveDocumentObjectKey(module, projectId, documentId);
  const state = sanitizeWorkspaceState(module, body.state, workspaceKey);
  const snapshotState: FmeaWorkspaceState = {
    ...state,
    workspaceKey,
    archiveCurrentDocumentId: documentId,
    updatedAt: createdAt,
  };

  try {
    const manifest = await readManifest(module, projectId);
    const upload = await putOssObject({
      objectKey: documentObjectKey,
      body: Buffer.from(
        JSON.stringify({
          schemaVersion: 1,
          module,
          projectId,
          document: {
            id: documentId,
            projectId,
            version,
            createdAt,
            ossUrl: '',
          },
          state: snapshotState,
        } satisfies Omit<FmeaArchiveSnapshot, 'document'> & { document: Omit<StoredFmeaDocument, 'ossUrl'> & { ossUrl: string } }),
        'utf8',
      ),
      mimeType: 'application/json',
      cacheControl: 'no-cache',
    });

    const storedDocument: StoredFmeaDocument = {
      id: documentId,
      projectId,
      version,
      createdAt,
      ossUrl: upload.url,
    };

    await putOssObject({
      objectKey: documentObjectKey,
      body: Buffer.from(
        JSON.stringify(
          {
            schemaVersion: 1,
            module,
            projectId,
            document: storedDocument,
            state: snapshotState,
          } satisfies FmeaArchiveSnapshot,
          null,
          2,
        ),
        'utf8',
      ),
      mimeType: 'application/json',
      cacheControl: 'no-cache',
    });

    await writeManifest(module, projectId, [
      storedDocument,
      ...(manifest?.documents ?? []).filter((item) => item.id !== documentId),
    ]);

    res.status(200).json({
      document: {
        ...storedDocument,
        isCurrent: true,
      } satisfies FmeaDocument,
    });
  } catch (error) {
    console.error('POST /api/dashboard/fmea-archives error:', error);
    sendFmeaArchiveRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_ARCHIVE_CREATE_FAILED',
    );
  }
}

export async function deleteDashboardFmeaArchiveDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const module = readModule(req.query.module);

  if (!module) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_MODULE');
    return;
  }

  const workspaceKey = readWorkspaceKey(req.query, module);
  const projectId = readProjectId(req.query, module, workspaceKey);
  const documentId = readDocumentId(req.query);

  if (!projectId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_PROJECT_ID');
    return;
  }

  if (!documentId) {
    sendFmeaArchiveRouteError(res, 400, 'INVALID_FMEA_ARCHIVE_DOCUMENT_ID');
    return;
  }

  try {
    const currentDocumentId = await readCurrentWorkspaceDocumentId(module, workspaceKey);

    if (currentDocumentId && currentDocumentId === documentId) {
      sendFmeaArchiveRouteError(res, 409, 'CURRENT_FMEA_ARCHIVE_DELETE_FORBIDDEN');
      return;
    }

    const manifest = await readManifest(module, projectId);

    await deleteOssObject(buildArchiveDocumentObjectKey(module, projectId, documentId)).catch((error) => {
      if (isOssNotFoundError(error)) {
        return;
      }

      throw error;
    });

    if (manifest) {
      await writeManifest(
        module,
        projectId,
        manifest.documents.filter((document) => document.id !== documentId),
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('DELETE /api/dashboard/fmea-archives error:', error);
    sendFmeaArchiveRouteError(
      res,
      isOssConfigError(error) ? 503 : 500,
      isOssConfigError(error) ? 'UPLOADS_NOT_CONFIGURED' : 'FMEA_ARCHIVE_DELETE_FAILED',
    );
  }
}
