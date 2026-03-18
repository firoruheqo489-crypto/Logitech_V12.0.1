import type { NextFunction, Request, RequestHandler, Response } from 'express';

const TRUSTED_WRITE_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const PUBLIC_READ_METHODS = 'GET, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, x-api-key';

export const API_TRUSTED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://120.27.153.140',
  'http://120.27.153.140:3000',
]);

function applyOriginHeader(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}

function handleTrustedPreflight(res: Response, origin: string): void {
  applyOriginHeader(res, origin);
  res.setHeader('Access-Control-Allow-Methods', TRUSTED_WRITE_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
}

function handlePublicPreflight(res: Response, origin: string | undefined): void {
  if (origin) {
    applyOriginHeader(res, origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', PUBLIC_READ_METHODS);
  res.sendStatus(204);
}

export function createApiCorsMiddleware(trustedOrigins: ReadonlySet<string>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const isTrustedOrigin = !!origin && trustedOrigins.has(origin);

    if (req.method === 'OPTIONS') {
      if (isTrustedOrigin && origin) {
        handleTrustedPreflight(res, origin);
        return;
      }

      handlePublicPreflight(res, origin);
      return;
    }

    if (origin) {
      applyOriginHeader(res, origin);
      if (isTrustedOrigin) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    next();
  };
}

export const apiCors = createApiCorsMiddleware(API_TRUSTED_ORIGINS);
