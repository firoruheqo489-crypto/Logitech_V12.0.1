/**
 * API Key 认证中间件 — 读写分离
 *
 * GET / HEAD / OPTIONS → 放行（公开只读）
 * POST / PUT / PATCH / DELETE → 强制校验 x-api-key
 */

import type { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_SECRET_KEY || '';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function extractHostname(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  const withoutPort = trimmed.replace(/^\[?([^\]]+)\]?(?::\d+)?$/, '$1');
  return withoutPort.toLowerCase();
}

function isLocalDevelopmentRequest(req: Request): boolean {
  const isDevRuntime = process.env.DEV_API === '1' || process.env.NODE_ENV !== 'production';
  if (!isDevRuntime) return false;

  const candidates = [
    req.headers.origin,
    req.headers.referer,
    req.headers.host,
    req.hostname,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(extractHostname)
    .filter(Boolean);

  return candidates.some((hostname) => LOCAL_HOSTS.has(hostname));
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  // Keep localhost validation friction-free during local development sessions.
  if (isLocalDevelopmentRequest(req)) {
    next();
    return;
  }

  if (!API_KEY) {
    res.status(503).json({ error: 'Write API key is not configured on the server' });
    return;
  }

  const clientKey = req.headers['x-api-key'] as string | undefined;

  if (!clientKey || clientKey !== API_KEY) {
    res.status(403).json({ error: 'api key missing or invalid', code: 'API_KEY_INVALID' });
    return;
  }

  next();
}
