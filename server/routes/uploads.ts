import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  createSignedAssetUrl,
  deleteAssetFromOssUrl,
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
    fileSize: 25 * 1024 * 1024,
  },
});

function sendUploadsRouteError(
  res: Response,
  status: number,
  code: UploadsRouteErrorCode,
): void {
  if (res.headersSent || res.writableEnded || res.destroyed) {
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

const uploadsRouter = Router();

uploadsRouter.get('/object', async (req: Request, res: Response) => {
  const objectKey = parseOssObjectKeyFromUrl(
    typeof req.query.key === 'string'
      ? `/api/uploads/object?key=${encodeURIComponent(req.query.key)}`
      : null,
  );

  if (!objectKey) {
    sendUploadsRouteError(res, 400, 'ASSET_KEY_REQUIRED');
    return;
  }

  try {
    const signedUrl = createSignedAssetUrl(objectKey);
    res.redirect(302, signedUrl);
  } catch (error) {
    if (res.headersSent || res.writableEnded || res.destroyed) {
      console.warn('GET /api/uploads/object aborted after response started:', error);
      return;
    }

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

uploadsRouter.post('/assets', upload.single('file'), async (req: Request, res: Response) => {
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

export { sendUploadsRouteError, uploadsRouter };
