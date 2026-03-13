/**
 * API Key 认证中间件
 *
 * 全量拦截：所有 /api 路由均需通过 x-api-key 校验。
 * 仅 OPTIONS 预检和 /api/health 健康探针例外。
 */

import type { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_SECRET_KEY || '';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const reqPath = `${req.baseUrl || ''}${req.path || ''}`;
  if (reqPath === '/api/health') {
    next();
    return;
  }

  if (!API_KEY) {
    next();
    return;
  }

  const clientKey = req.headers['x-api-key'] as string | undefined;

  if (!clientKey || clientKey !== API_KEY) {
    res.status(403).json({ error: '未授权：缺少或无效的 API Key' });
    return;
  }

  next();
}
