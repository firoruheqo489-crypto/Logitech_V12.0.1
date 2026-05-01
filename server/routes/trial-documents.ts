import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';
import {
  buildInlinePdfContentDisposition,
  buildTrialDocumentObjectKey,
  createSignedTrialPreviewUrl,
  createSignedTrialUploadUrl,
  getTrialDocumentObjectStream,
} from '../lib/oss.js';

const MAX_TRIAL_DOCUMENT_SIZE_BYTES = 100 * 1024 * 1024;
const PRESIGNED_URL_TTL_SECONDS = 300;
const TRIAL_DOCUMENT_CONTENT_TYPE = 'application/pdf';
const TRIAL_PREVIEW_TOKEN_VERSION = 'v1';

type TrialDocumentRow = {
  id: string;
  upload_date: string | Date;
  mold_id: string | null;
  mold_no: string | null;
  cavity_number: string | null;
  component_name: string;
  file_name: string;
  file_size: number | string;
  storage_path: string;
  created_at: string | Date;
};

type TrialDocument = {
  id: string;
  uploadDate: string;
  moldId: string;
  moldNo: string;
  cavityNumber: string;
  componentName: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  createdAt: string;
};

type TrialDocumentsRouteErrorCode =
  | 'DATABASE_NOT_CONFIGURED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'INVALID_REQUEST'
  | 'INVALID_PREVIEW_TOKEN'
  | 'NOT_FOUND'
  | 'OSS_NOT_CONFIGURED'
  | 'TRIAL_DOCUMENT_SAVE_FAILED'
  | 'TRIAL_DOCUMENTS_LOAD_FAILED'
  | 'TRIAL_PREVIEW_URL_FAILED'
  | 'TRIAL_UPLOAD_URL_FAILED';

const TRIAL_DOCUMENTS_ERROR_MESSAGES: Record<TrialDocumentsRouteErrorCode, string> = {
  DATABASE_NOT_CONFIGURED: 'database not configured',
  FILE_TOO_LARGE: 'file too large',
  INVALID_FILE_TYPE: 'only PDF files are allowed',
  INVALID_PREVIEW_TOKEN: 'invalid or expired preview token',
  INVALID_REQUEST: 'invalid request',
  NOT_FOUND: 'not found',
  OSS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
  TRIAL_DOCUMENT_SAVE_FAILED: 'failed to save trial document',
  TRIAL_DOCUMENTS_LOAD_FAILED: 'failed to load trial documents',
  TRIAL_PREVIEW_URL_FAILED: 'failed to create preview url',
  TRIAL_UPLOAD_URL_FAILED: 'failed to create upload url',
};

let trialDocumentsTableReady: Promise<void> | null = null;

function sendTrialDocumentsRouteError(
  res: Response,
  status: number,
  code: TrialDocumentsRouteErrorCode,
): void {
  res.status(status).json({
    error: TRIAL_DOCUMENTS_ERROR_MESSAGES[code],
    code,
  });
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readQueryText(value: unknown): string {
  return Array.isArray(value) ? readText(value[0]) : readText(value);
}

function normalizeUploadDate(value: unknown): string {
  const normalized = readText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function mapTrialDocument(row: TrialDocumentRow): TrialDocument {
  const uploadDate = row.upload_date instanceof Date
    ? row.upload_date.toISOString().slice(0, 10)
    : String(row.upload_date).slice(0, 10);
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : String(row.created_at);

  return {
    id: row.id,
    uploadDate,
    moldId: row.mold_id || '',
    moldNo: row.mold_no || '',
    cavityNumber: row.cavity_number || '',
    componentName: row.component_name,
    fileName: row.file_name,
    fileSize: Number(row.file_size),
    storagePath: row.storage_path,
    createdAt,
  };
}

function isPdfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf');
}

function readFileSize(value: unknown): number {
  const size = Number(value);
  return Number.isFinite(size) ? Math.round(size) : 0;
}

function isOssConfigurationError(error: unknown): boolean {
  return String(error ?? '').includes('ALIYUN_OSS_');
}

function readPreviewSigningSecret(): string {
  return (
    process.env.API_SECRET_KEY?.trim() ||
    process.env.DASHBOARD_WRITE_PASSWORD?.trim() ||
    process.env.ALIYUN_OSS_ACCESS_KEY_SECRET?.trim() ||
    ''
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPreviewTicket(storagePath: string, expiresAt: number): string {
  const secret = readPreviewSigningSecret();
  if (!secret) {
    throw new Error('TRIAL_PREVIEW_SIGNING_SECRET is not configured');
  }

  return createHmac('sha256', secret)
    .update(`${TRIAL_PREVIEW_TOKEN_VERSION}.${expiresAt}.${storagePath}`)
    .digest('base64url');
}

function createPreviewTicketUrl(storagePath: string, expiresSeconds: number): string {
  const expiresAt = Date.now() + expiresSeconds * 1000;
  const signature = signPreviewTicket(storagePath, expiresAt);
  const params = new URLSearchParams({
    storagePath,
    expiresAt: String(expiresAt),
    signature,
  });

  return `/api/dashboard/trial-documents/preview?${params.toString()}`;
}

function isValidPreviewTicket(storagePath: string, expiresAt: number, signature: string): boolean {
  if (!storagePath || !signature || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  try {
    return safeEqual(signature, signPreviewTicket(storagePath, expiresAt));
  } catch {
    return false;
  }
}

export function ensureTrialDocumentsTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  const sql = dbSql;
  if (!trialDocumentsTableReady) {
    trialDocumentsTableReady = sql.unsafe(`
      CREATE TABLE IF NOT EXISTS trial_documents (
        id TEXT PRIMARY KEY,
        upload_date DATE NOT NULL,
        mold_id TEXT NOT NULL DEFAULT '',
        mold_no TEXT NOT NULL DEFAULT '',
        cavity_number TEXT NOT NULL DEFAULT '',
        component_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size BIGINT NOT NULL CHECK (file_size > 0),
        storage_path TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
      .then(() =>
        sql.unsafe(`
          ALTER TABLE trial_documents
          ADD COLUMN IF NOT EXISTS mold_id TEXT NOT NULL DEFAULT ''
        `),
      )
      .then(() =>
        sql.unsafe(`
          ALTER TABLE trial_documents
          ADD COLUMN IF NOT EXISTS mold_no TEXT NOT NULL DEFAULT ''
        `),
      )
      .then(() =>
        sql.unsafe(`
          ALTER TABLE trial_documents
          ADD COLUMN IF NOT EXISTS cavity_number TEXT NOT NULL DEFAULT ''
        `),
      )
      .then(() =>
        sql.unsafe(`
          CREATE INDEX IF NOT EXISTS trial_documents_upload_date_idx
          ON trial_documents (upload_date DESC, created_at DESC)
        `),
      )
      .then(() =>
        sql.unsafe(`
          CREATE INDEX IF NOT EXISTS trial_documents_scope_idx
          ON trial_documents (mold_id, cavity_number, upload_date DESC, created_at DESC)
        `),
      )
      .then(() => undefined);
  }
  return trialDocumentsTableReady;
}

async function findTrialDocumentByStoragePath(storagePath: string): Promise<TrialDocument | null> {
  if (!dbSql) return null;
  await ensureTrialDocumentsTable();
  const rows = await dbSql.unsafe(
    `
      SELECT id, upload_date, mold_id, mold_no, cavity_number, component_name, file_name, file_size, storage_path, created_at
      FROM trial_documents
      WHERE storage_path = $1
      LIMIT 1
    `,
    [storagePath],
  ) as unknown as TrialDocumentRow[];

  return rows[0] ? mapTrialDocument(rows[0]) : null;
}

export async function createTrialUploadUrl(req: Request, res: Response): Promise<void> {
  const fileName = readText(req.body?.fileName);
  const contentType = TRIAL_DOCUMENT_CONTENT_TYPE;
  const uploadDate = normalizeUploadDate(req.body?.uploadDate);
  const moldId = readText(req.body?.moldId);
  const moldNo = readText(req.body?.moldNo);
  const cavityNumber = readText(req.body?.cavityNumber);
  const componentName = readText(req.body?.componentName);
  const fileSize = readFileSize(req.body?.fileSize);

  if (!fileName || !uploadDate || !moldId || !componentName || fileSize <= 0) {
    sendTrialDocumentsRouteError(res, 400, 'INVALID_REQUEST');
    return;
  }
  if (!isPdfFileName(fileName)) {
    sendTrialDocumentsRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }
  if (fileSize > MAX_TRIAL_DOCUMENT_SIZE_BYTES) {
    sendTrialDocumentsRouteError(res, 413, 'FILE_TOO_LARGE');
    return;
  }

  try {
    const storagePath = buildTrialDocumentObjectKey({
      fileName,
      uploadDate,
      moldId,
      cavityNumber,
      componentName,
    });
    const uploadUrl = createSignedTrialUploadUrl(storagePath, contentType, PRESIGNED_URL_TTL_SECONDS);

    res.status(200).json({
      uploadUrl,
      storagePath,
      moldId,
      moldNo,
      cavityNumber,
      expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error) {
    console.error('POST /api/storage/presigned-url/upload-url error:', error);
    sendTrialDocumentsRouteError(
      res,
      isOssConfigurationError(error) ? 503 : 500,
      isOssConfigurationError(error) ? 'OSS_NOT_CONFIGURED' : 'TRIAL_UPLOAD_URL_FAILED',
    );
  }
}

export async function createTrialPreviewUrl(req: Request, res: Response): Promise<void> {
  const storagePath = readText(req.body?.storagePath) || readText(req.body?.storage_path);
  if (!storagePath) {
    sendTrialDocumentsRouteError(res, 400, 'INVALID_REQUEST');
    return;
  }

  if (!dbSql) {
    sendTrialDocumentsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    const document = await findTrialDocumentByStoragePath(storagePath);
    if (!document) {
      sendTrialDocumentsRouteError(res, 404, 'NOT_FOUND');
      return;
    }

    const previewUrl = createSignedTrialPreviewUrl(
      document.storagePath,
      document.fileName,
      PRESIGNED_URL_TTL_SECONDS,
    );
    const inlinePreviewUrl = createPreviewTicketUrl(document.storagePath, PRESIGNED_URL_TTL_SECONDS);

    res.status(200).json({
      previewUrl: inlinePreviewUrl,
      ossPreviewUrl: previewUrl,
      expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    console.error('POST /api/storage/presigned-url/preview-url error:', error);
    sendTrialDocumentsRouteError(
      res,
      isOssConfigurationError(error) ? 503 : 500,
      isOssConfigurationError(error) ? 'OSS_NOT_CONFIGURED' : 'TRIAL_PREVIEW_URL_FAILED',
    );
  }
}

export async function streamTrialDocumentPreview(req: Request, res: Response): Promise<void> {
  const storagePath = readText(req.query.storagePath);
  const expiresAt = Number(readText(req.query.expiresAt));
  const signature = readText(req.query.signature);

  if (!isValidPreviewTicket(storagePath, expiresAt, signature)) {
    sendTrialDocumentsRouteError(res, 403, 'INVALID_PREVIEW_TOKEN');
    return;
  }

  if (!dbSql) {
    sendTrialDocumentsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    const document = await findTrialDocumentByStoragePath(storagePath);
    if (!document) {
      sendTrialDocumentsRouteError(res, 404, 'NOT_FOUND');
      return;
    }

    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const ossObject = await getTrialDocumentObjectStream(document.storagePath, rangeHeader);

    res.status(ossObject.status);
    Object.entries(ossObject.headers).forEach(([headerName, headerValue]) => {
      if (headerValue === undefined) return;
      const normalizedHeaderName = headerName.toLowerCase();
      if (normalizedHeaderName === 'content-type' || normalizedHeaderName === 'content-disposition') {
        return;
      }
      res.setHeader(headerName, headerValue as string | number | readonly string[]);
    });
    res.setHeader('Content-Type', TRIAL_DOCUMENT_CONTENT_TYPE);
    res.setHeader('Content-Disposition', buildInlinePdfContentDisposition(document.fileName));
    res.setHeader('X-Content-Type-Options', 'nosniff');

    await pipeline(ossObject.stream, res);
  } catch (error) {
    console.error('GET /api/dashboard/trial-documents/preview error:', error);
    if (!res.headersSent) {
      sendTrialDocumentsRouteError(
        res,
        isOssConfigurationError(error) ? 503 : 500,
        isOssConfigurationError(error) ? 'OSS_NOT_CONFIGURED' : 'TRIAL_PREVIEW_URL_FAILED',
      );
    }
  }
}

export async function listTrialDocuments(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendTrialDocumentsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureTrialDocumentsTable();
    const moldId = readQueryText(req.query.moldId);
    const cavityNumber = readQueryText(req.query.cavityNumber);
    const filters: string[] = [];
    const params: string[] = [];

    if (moldId) {
      params.push(moldId);
      filters.push(`mold_id = $${params.length}`);
    }
    if (cavityNumber) {
      params.push(cavityNumber);
      filters.push(`cavity_number = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await dbSql.unsafe(`
      SELECT id, upload_date, mold_id, mold_no, cavity_number, component_name, file_name, file_size, storage_path, created_at
      FROM trial_documents
      ${whereClause}
      ORDER BY upload_date DESC, created_at DESC
    `, params) as unknown as TrialDocumentRow[];

    res.status(200).json({ documents: rows.map(mapTrialDocument) });
  } catch (error) {
    console.error('GET /api/dashboard/trial-documents error:', error);
    sendTrialDocumentsRouteError(res, 500, 'TRIAL_DOCUMENTS_LOAD_FAILED');
  }
}

export async function insertTrialDocument(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendTrialDocumentsRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const uploadDate = normalizeUploadDate(req.body?.uploadDate);
  const moldId = readText(req.body?.moldId);
  const moldNo = readText(req.body?.moldNo);
  const cavityNumber = readText(req.body?.cavityNumber);
  const componentName = readText(req.body?.componentName);
  const fileName = readText(req.body?.fileName);
  const fileSize = readFileSize(req.body?.fileSize);
  const storagePath = readText(req.body?.storagePath);

  if (!uploadDate || !moldId || !componentName || !fileName || !storagePath || fileSize <= 0) {
    sendTrialDocumentsRouteError(res, 400, 'INVALID_REQUEST');
    return;
  }
  if (!isPdfFileName(fileName)) {
    sendTrialDocumentsRouteError(res, 415, 'INVALID_FILE_TYPE');
    return;
  }
  if (fileSize > MAX_TRIAL_DOCUMENT_SIZE_BYTES) {
    sendTrialDocumentsRouteError(res, 413, 'FILE_TOO_LARGE');
    return;
  }

  try {
    await ensureTrialDocumentsTable();
    const rows = await dbSql.unsafe(
      `
        INSERT INTO trial_documents (
          id,
          upload_date,
          mold_id,
          mold_no,
          cavity_number,
          component_name,
          file_name,
          file_size,
          storage_path
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, upload_date, mold_id, mold_no, cavity_number, component_name, file_name, file_size, storage_path, created_at
      `,
      [randomUUID(), uploadDate, moldId, moldNo, cavityNumber, componentName, fileName, fileSize, storagePath],
    ) as unknown as TrialDocumentRow[];

    res.status(201).json({ document: mapTrialDocument(rows[0]) });
  } catch (error) {
    console.error('POST /api/dashboard/trial-documents error:', error);
    sendTrialDocumentsRouteError(res, 500, 'TRIAL_DOCUMENT_SAVE_FAILED');
  }
}
