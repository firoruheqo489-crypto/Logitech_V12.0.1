import { Router, type Request, type Response } from 'express';
import {
  createWriteSessionToken,
  hasValidWriteSession,
  isValidWriteLoginSecret,
  isWriteLoginConfigured,
  WRITE_SESSION_COOKIE_NAME,
  WRITE_SESSION_TTL_SECONDS,
} from '../middleware/auth.js';

const authSessionRouter = Router();

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const firstForwardedProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  return req.secure || firstForwardedProto === 'https';
}

function readSubmittedKey(req: Request): string {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};
  const value = body.apiKey ?? body.password;
  return typeof value === 'string' ? value.trim() : '';
}

function sendAuthError(
  res: Response,
  status: number,
  code: 'API_KEY_INVALID' | 'WRITE_LOGIN_NOT_CONFIGURED',
): void {
  res.status(status).json({
    error: code === 'WRITE_LOGIN_NOT_CONFIGURED'
      ? 'Dashboard admin password is not configured on the server'
      : 'api key missing or invalid',
    code,
  });
}

authSessionRouter.get('/write-session', (req: Request, res: Response) => {
  res.status(200).json({
    authenticated: hasValidWriteSession(req),
    configured: isWriteLoginConfigured(),
  });
});

authSessionRouter.post('/write-session', (req: Request, res: Response) => {
  if (!isWriteLoginConfigured()) {
    sendAuthError(res, 503, 'WRITE_LOGIN_NOT_CONFIGURED');
    return;
  }

  if (!isValidWriteLoginSecret(readSubmittedKey(req))) {
    sendAuthError(res, 403, 'API_KEY_INVALID');
    return;
  }

  res.cookie(WRITE_SESSION_COOKIE_NAME, createWriteSessionToken(), {
    httpOnly: true,
    maxAge: WRITE_SESSION_TTL_SECONDS * 1000,
    path: '/',
    sameSite: 'lax',
    secure: isSecureRequest(req),
  });

  res.status(200).json({
    authenticated: true,
    expiresInSeconds: WRITE_SESSION_TTL_SECONDS,
  });
});

authSessionRouter.delete('/write-session', (_req: Request, res: Response) => {
  res.clearCookie(WRITE_SESSION_COOKIE_NAME, {
    path: '/',
    sameSite: 'lax',
  });

  res.status(200).json({
    authenticated: false,
  });
});

export { authSessionRouter };
