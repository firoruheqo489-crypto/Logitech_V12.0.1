/**
 * API Key 认证中间件 — 读写分离
 *
 * GET / HEAD / OPTIONS → 放行（公开只读）
 * POST / PUT / PATCH / DELETE → 强制校验 x-api-key
 */

import type { NextFunction, Request, Response } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const API_KEY = process.env.API_SECRET_KEY || '';
const DASHBOARD_WRITE_PASSWORD = process.env.DASHBOARD_WRITE_PASSWORD || '';
const IS_DEV_API_MODE = process.env.DEV_API === '1';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
export const WRITE_SESSION_COOKIE_NAME = 'dashboard_write_session';
export const WRITE_SESSION_TTL_SECONDS = 12 * 60 * 60;

const WRITE_SESSION_VERSION = 'v1';

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

function readHeaderValue(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return '';
}

function readCookieValue(req: Request, cookieName: string): string {
  const cookieHeader = readHeaderValue(req.headers.cookie);
  if (!cookieHeader) return '';

  for (const pair of cookieHeader.split(';')) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = pair.slice(0, separatorIndex).trim();
    if (name !== cookieName) continue;

    const rawValue = pair.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return '';
}

function signWriteSessionPayload(payload: string): string {
  return createHmac('sha256', API_KEY).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isPublicWriteSessionRoute(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
    return false;
  }

  const originalPath = (req.originalUrl || '').split('?')[0] || '';
  const mountedPath = `${req.baseUrl || ''}${req.path || ''}`;
  const candidates = new Set([req.path || '', originalPath, mountedPath]);

  return candidates.has('/auth/write-session') || candidates.has('/api/auth/write-session');
}

export function isWriteApiConfigured(): boolean {
  return Boolean(API_KEY);
}

export function isValidWriteApiKey(value: unknown): boolean {
  return typeof value === 'string' && Boolean(API_KEY) && value === API_KEY;
}

export function isValidWriteLoginSecret(value: unknown): boolean {
  if (typeof value !== 'string' || !API_KEY) return false;
  if (value === API_KEY) return true;
  return Boolean(DASHBOARD_WRITE_PASSWORD) && value === DASHBOARD_WRITE_PASSWORD;
}

export function createWriteSessionToken(now = Date.now()): string {
  if (!API_KEY) {
    throw new Error('API_SECRET_KEY is required to create a write session');
  }

  const expiresAt = now + WRITE_SESSION_TTL_SECONDS * 1000;
  const nonce = randomUUID();
  const payload = `${WRITE_SESSION_VERSION}.${expiresAt}.${nonce}`;
  const signature = signWriteSessionPayload(payload);
  return `${payload}.${signature}`;
}

export function isValidWriteSessionToken(token: string, now = Date.now()): boolean {
  if (!API_KEY || !token) return false;

  const parts = token.split('.');
  if (parts.length !== 4) return false;

  const [version, expiresAtRaw, nonce, signature] = parts;
  if (version !== WRITE_SESSION_VERSION || !nonce || !signature) return false;

  const expiresAt = Number.parseInt(expiresAtRaw || '', 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;

  const payload = `${version}.${expiresAtRaw}.${nonce}`;
  const expectedSignature = signWriteSessionPayload(payload);
  return safeEqual(signature, expectedSignature);
}

export function hasValidWriteSession(req: Request): boolean {
  return isValidWriteSessionToken(readCookieValue(req, WRITE_SESSION_COOKIE_NAME));
}

export function hasValidWriteApiKeyHeader(req: Request): boolean {
  return isValidWriteApiKey(readHeaderValue(req.headers['x-api-key']));
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  if (isPublicWriteSessionRoute(req)) {
    next();
    return;
  }

  // Keep localhost validation friction-free during local development sessions.
  if (isLocalDevelopmentRequest(req)) {
    next();
    return;
  }

  if (!API_KEY) {
    sendAuthError(res, 503, 'API_KEY_NOT_CONFIGURED');
    return;
  }

  if (!hasValidWriteApiKeyHeader(req) && !hasValidWriteSession(req)) {
    sendAuthError(res, 403, 'API_KEY_INVALID');
    return;
  }

  next();
}
