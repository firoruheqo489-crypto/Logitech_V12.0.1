/**
 * API Key 认证中间件 — 读写分离
 *
 * GET / HEAD / OPTIONS → 放行（公开只读）
 * POST / PUT / PATCH / DELETE → 强制校验 x-api-key
 */

import type { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_SECRET_KEY || '';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (!API_KEY) {
    next();
    return;
  }

  const clientKey = req.headers['x-api-key'] as string | undefined;

  if (!clientKey || clientKey !== API_KEY) {
    res.status(403).json({ error: 'api key missing or invalid', code: 'API_KEY_INVALID' });
    return;
  }

  next();
}
