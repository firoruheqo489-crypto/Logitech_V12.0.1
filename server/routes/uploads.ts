/// <reference path="../types/multer.d.ts" />
import { Router, type NextFunction, type Request, type Response } from 'express';
// @ts-ignore local declaration fallback covers runtime usage even when @types/multer is incomplete
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  deleteAssetFromOssUrl,
  getOssObjectStream,
  parseOssObjectKeyFromUrl,
  uploadAssetToOss,
} from '../lib/oss.js';

type UploadsRouteErrorCode =
  | 'ASSET_DELETE_FAILED'
  | 'ASSET_KEY_REQUIRED'
  | 'ASSET_NOT_FOUND'
  | 'ASSET_UPLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  | 'FILE_REQUIRED'
  | 'INVALID_FILE_TYPE'
  | 'UPLOADS_NOT_CONFIGURED';

const UPLOADS_ROUTE_ERROR_MESSAGES: Record<UploadsRouteErrorCode, string> = {
  ASSET_DELETE_FAILED: 'Failed to delete asset',
  ASSET_KEY_REQUIRED: 'key is required',
  ASSET_NOT_FOUND: 'Asset not found',
  ASSET_UPLOAD_FAILED: 'Failed to upload asset',
  FILE_TOO_LARGE: 'file too large',
  FILE_REQUIRED: 'file is required',
  INVALID_FILE_TYPE: 'unsupported file type',
  UPLOADS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
};

const UPLOADS_TEMP_DIR = path.resolve(process.cwd(), 'uploads_temp');
const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_UPLOAD_RULES: Record<string, ReadonlySet<string>> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new Set(['.docx']),
  'application/pdf': new Set(['.pdf']),
  'image/jpeg': new Set(['.jpeg', '.jpg']),
  'image/png': new Set(['.png']),
};

mkdirSync(UPLOADS_TEMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, UPLOADS_TEMP_DIR);
    },
    filename: (_req, file, callback) => {
      const extension = resolvePreferredExtension(file);
      callback(null, `${Date.now()}-${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedUploadFile(file)) {
      callback(new Error('INVALID_FILE_TYPE'));
      return;
    }
    callback(null, true);
  },
});

function shouldAbortResponseWrite(res: Response): boolean {
  if (res.headersSent) {
    console.warn('[System Audit] Headers already sent, intercepting duplicate response to prevent crash.');
    return true;
  }

  if (res.writableEnded || res.destroyed) {
    console.warn('[System Audit] Response stream closed, skipping response write to prevent crash.');
    return true;
  }

  return false;
}

function sendUploadsRouteError(
  res: Response,
  status: number,
  code: UploadsRouteErrorCode,
): void {
  if (shouldAbortResponseWrite(res)) {
    return;
  }

  res.status(status).json({
    error: UPLOADS_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

function readMultipartField(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function inferExtension(filename: string): string {
  return path.extname(filename.trim()).toLowerCase();
}

function resolvePreferredExtension(input: { originalname: string; mimetype: string }): string {
  const mimetype = input.mimetype.trim().toLowerCase();
  const extension = inferExtension(input.originalname);
  const allowedExtensions = ALLOWED_UPLOAD_RULES[mimetype];
  if (!allowedExtensions) {
    return '';
  }

  if (allowedExtensions.has(extension)) {
    return extension;
  }

  return [...allowedExtensions][0] ?? '';
}

function isAllowedUploadFile(input: { originalname: string; mimetype: string }): boolean {
  const mimetype = input.mimetype.trim().toLowerCase();
  const extension = inferExtension(input.originalname);
  const allowedExtensions = ALLOWED_UPLOAD_RULES[mimetype];
  if (!allowedExtensions || !extension) {
    return false;
  }

  return allowedExtensions.has(extension);
}

function isMulterFileSizeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code === 'LIMIT_FILE_SIZE';
}

function isInvalidFileTypeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message === 'INVALID_FILE_TYPE';
}

async function cleanupTempFile(filePath: string | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== 'ENOENT') {
      console.warn('Failed to cleanup temp upload file:', filePath, error);
    }
  }
}

type UploadRequest = Request & {
  file?: {
    path: string;
    size: number;
    filename: string;
    originalname: string;
    mimetype: string;
  };
};

const uploadsRouter = Router();

async function handleAssetUpload(req: UploadRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    sendUploadsRouteError(res, 400, 'FILE_REQUIRED');
    return;
  }

  try {
    if (!isAllowedUploadFile(file)) {
      sendUploadsRouteError(res, 415, 'INVALID_FILE_TYPE');
      return;
    }

    const uploaded = await uploadAssetToOss({
      fileStream: createReadStream(file.path),
      fileSize: file.size,
      filename: file.originalname,
      mimeType: file.mimetype,
      category: readMultipartField(req.body?.category),
      entityId: readMultipartField(req.body?.entityId),
      slot: readMultipartField(req.body?.slot),
    });

    if (shouldAbortResponseWrite(res)) {
      return;
    }

    res.status(201).json(uploaded);
  } catch (error) {
    const details = String(error ?? '');
    const code =
      details.includes('ALIYUN_OSS_')
        ? 'UPLOADS_NOT_CONFIGURED'
        : 'ASSET_UPLOAD_FAILED';

    console.error('POST /api/uploads/assets error:', error);
    sendUploadsRouteError(res, code === 'UPLOADS_NOT_CONFIGURED' ? 503 : 500, code);
  } finally {
    await cleanupTempFile(file.path);
  }
}

uploadsRouter.get('/object', async (req: Request, res: Response) => {
  const queryKey = Array.isArray(req.query.key) ? req.query.key[0] : req.query.key;
  const objectKey = parseOssObjectKeyFromUrl(typeof queryKey === 'string' ? queryKey : null);

  if (!objectKey) {
    sendUploadsRouteError(res, 400, 'ASSET_KEY_REQUIRED');
    return;
  }

  try {
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const ossObject = await getOssObjectStream(objectKey, rangeHeader);

    if (shouldAbortResponseWrite(res)) {
      return;
    }

    res.status(ossObject.status);
    Object.entries(ossObject.headers).forEach(([headerName, headerValue]) => {
      if (headerValue === undefined) return;
      res.setHeader(headerName, headerValue as string | number | readonly string[]);
    });

    await pipeline(ossObject.stream, res);
  } catch (error) {
    const details = String(error ?? '');
    const code =
      details.includes('NoSuchKey')
        ? 'ASSET_NOT_FOUND'
        : details.includes('ALIYUN_OSS_')
          ? 'UPLOADS_NOT_CONFIGURED'
          : 'ASSET_UPLOAD_FAILED';

    console.error('GET /api/uploads/object error:', error);
    if (shouldAbortResponseWrite(res)) {
      return;
    }

    sendUploadsRouteError(
      res,
      code === 'ASSET_NOT_FOUND' ? 404 : code === 'UPLOADS_NOT_CONFIGURED' ? 503 : 500,
      code,
    );
  }
});

uploadsRouter.post('/assets', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      void handleAssetUpload(req as UploadRequest, res);
      return;
    }

    if (isMulterFileSizeError(error)) {
      sendUploadsRouteError(res, 413, 'FILE_TOO_LARGE');
      return;
    }

    if (isInvalidFileTypeError(error)) {
      sendUploadsRouteError(res, 415, 'INVALID_FILE_TYPE');
      return;
    }

    next(error);
  });
});

uploadsRouter.delete('/assets', async (req: Request, res: Response) => {
  const assetUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

  if (!assetUrl) {
    if (shouldAbortResponseWrite(res)) {
      return;
    }

    res.status(200).json({ success: true, deleted: false, skipped: true });
    return;
  }

  try {
    const result = await deleteAssetFromOssUrl(assetUrl);
    if (shouldAbortResponseWrite(res)) {
      return;
    }

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    const details = String(error ?? '');
    const code =
      details.includes('ALIYUN_OSS_')
        ? 'UPLOADS_NOT_CONFIGURED'
        : 'ASSET_DELETE_FAILED';

    console.error('DELETE /api/uploads/assets error:', error);
    sendUploadsRouteError(res, code === 'UPLOADS_NOT_CONFIGURED' ? 503 : 500, code);
  }
});

export { uploadsRouter };
