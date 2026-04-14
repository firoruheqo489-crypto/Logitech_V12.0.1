/// <reference path="../types/multer.d.ts" />
import { Router, type Request, type Response } from 'express';
// @ts-ignore local declaration fallback covers runtime usage even when @types/multer is incomplete
import multer from 'multer';
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
  | 'FILE_REQUIRED'
  | 'UPLOADS_NOT_CONFIGURED';

const UPLOADS_ROUTE_ERROR_MESSAGES: Record<UploadsRouteErrorCode, string> = {
  ASSET_DELETE_FAILED: 'Failed to delete asset',
  ASSET_KEY_REQUIRED: 'key is required',
  ASSET_NOT_FOUND: 'Asset not found',
  ASSET_UPLOAD_FAILED: 'Failed to upload asset',
  FILE_REQUIRED: 'file is required',
  UPLOADS_NOT_CONFIGURED: 'Aliyun OSS is not configured',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // Multi-page engineering PDFs are often larger than typical image uploads.
    fileSize: 100 * 1024 * 1024,
  },
});

function sendUploadsRouteError(
  res: Response,
  status: number,
  code: UploadsRouteErrorCode,
): void {
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

type UploadRequest = Request & {
  file?: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  };
};

const uploadsRouter = Router();

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
    sendUploadsRouteError(
      res,
      code === 'ASSET_NOT_FOUND' ? 404 : code === 'UPLOADS_NOT_CONFIGURED' ? 503 : 500,
      code,
    );
  }
});

uploadsRouter.post('/assets', upload.single('file'), async (req: UploadRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    sendUploadsRouteError(res, 400, 'FILE_REQUIRED');
    return;
  }

  try {
    const uploaded = await uploadAssetToOss({
      fileBuffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      category: readMultipartField(req.body?.category),
      entityId: readMultipartField(req.body?.entityId),
      slot: readMultipartField(req.body?.slot),
    });

    res.status(201).json(uploaded);
  } catch (error) {
    const details = String(error ?? '');
    const code =
      details.includes('ALIYUN_OSS_')
        ? 'UPLOADS_NOT_CONFIGURED'
        : 'ASSET_UPLOAD_FAILED';

    console.error('POST /api/uploads/assets error:', error);
    sendUploadsRouteError(res, code === 'UPLOADS_NOT_CONFIGURED' ? 503 : 500, code);
  }
});

uploadsRouter.delete('/assets', async (req: Request, res: Response) => {
  const assetUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

  if (!assetUrl) {
    res.status(200).json({ success: true, deleted: false, skipped: true });
    return;
  }

  try {
    const result = await deleteAssetFromOssUrl(assetUrl);
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
