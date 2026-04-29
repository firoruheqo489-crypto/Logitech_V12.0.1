/**
 * API Key 认证中间件 — 读写分离
 *
 * GET / HEAD / OPTIONS → 放行（公开只读）
 * POST / PUT / PATCH / DELETE → 强制校验 x-api-key
 */

import type { NextFunction, Request, Response } from 'express';
import { API_TRUSTED_ORIGINS } from './apiCors.js';

const API_KEY = process.env.API_SECRET_KEY || '';
const IS_DEV_API_MODE = process.env.DEV_API === '1';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type AuthErrorCode = 'API_KEY_INVALID' | 'API_KEY_NOT_CONFIGURED';

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  API_KEY_INVALID: 'api key missing or invalid',
  API_KEY_NOT_CONFIGURED: 'Write API key is not configured on the server',
};

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

function isTrustedOrigin(value: unknown): value is string {
  return typeof value === 'string' && API_TRUSTED_ORIGINS.has(value);
}

function isTrustedBrowserWriteRequest(req: Request): boolean {
  const originHeader = req.headers.origin;
  if (!isTrustedOrigin(originHeader)) {
    return false;
  }

  const originUrl = new URL(originHeader);
  const requestHost = String(req.headers.host ?? '').trim().toLowerCase();
  const requestHostname = String(req.hostname ?? '').trim().toLowerCase();
  const originHost = originUrl.host.toLowerCase();
  const originHostname = originUrl.hostname.toLowerCase();

  if (requestHost && requestHost === originHost) {
    return true;
  }

  if (requestHostname && requestHostname === originHostname) {
    return true;
  }

  return false;
}

function isLocalDevelopmentRequest(req: Request): boolean {
  if (!IS_DEV_API_MODE) return false;

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

function sendAuthError(res: Response, status: number, code: AuthErrorCode): void {
  res.status(status).json({
    error: AUTH_ERROR_MESSAGES[code],
    code,
  });
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

  // Allow trusted same-origin dashboard writes without requiring each browser to hold the raw API secret.
  if (isTrustedBrowserWriteRequest(req)) {
    next();
    return;
  }

  if (!API_KEY) {
    sendAuthError(res, 503, 'API_KEY_NOT_CONFIGURED');
    return;
  }

  const clientKey = req.headers['x-api-key'] as string | undefined;

  if (!clientKey || clientKey !== API_KEY) {
    sendAuthError(res, 403, 'API_KEY_INVALID');
    return;
  }

  next();
}
