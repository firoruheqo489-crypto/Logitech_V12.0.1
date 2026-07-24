import { Router, type Request, type Response } from "express";
import {
  createDashboardAccessSessionToken,
  createWriteSessionToken,
  DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
  DASHBOARD_ACCESS_SESSION_TTL_SECONDS,
  hasDashboardAccess,
  hasValidWriteSession,
  isDashboardAccessConfigured,
  isValidDashboardAccessSecret,
  isValidWriteLoginSecret,
  isWriteLoginConfigured,
  WRITE_SESSION_COOKIE_NAME,
  WRITE_SESSION_TTL_SECONDS,
} from "../middleware/auth.js";

const authSessionRouter = Router();
const ACCESS_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ACCESS_LOGIN_MAX_FAILURES = 5;
const accessLoginFailures = new Map<
  string,
  { count: number; resetAt: number }
>();

function isSecureRequest(req: Request): boolean {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const firstForwardedProto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto;
  return req.secure || firstForwardedProto === "https";
}

function readSubmittedKey(req: Request): string {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  const value = body.apiKey ?? body.password;
  return typeof value === "string" ? value.trim() : "";
}

function sendAuthError(
  res: Response,
  status: number,
  code: "API_KEY_INVALID" | "WRITE_LOGIN_NOT_CONFIGURED"
): void {
  res.status(status).json({
    error:
      code === "WRITE_LOGIN_NOT_CONFIGURED"
        ? "Dashboard admin password is not configured on the server"
        : "api key missing or invalid",
    code,
  });
}

function getAccessLoginClientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function readAccessLoginRetryAfterSeconds(
  req: Request,
  now = Date.now()
): number {
  const key = getAccessLoginClientKey(req);
  const state = accessLoginFailures.get(key);
  if (!state) return 0;
  if (state.resetAt <= now) {
    accessLoginFailures.delete(key);
    return 0;
  }
  if (state.count < ACCESS_LOGIN_MAX_FAILURES) return 0;
  return Math.max(1, Math.ceil((state.resetAt - now) / 1000));
}

function recordAccessLoginFailure(req: Request, now = Date.now()): void {
  if (accessLoginFailures.size >= 1_000) {
    for (const [key, state] of accessLoginFailures) {
      if (state.resetAt <= now) accessLoginFailures.delete(key);
    }
  }

  const key = getAccessLoginClientKey(req);
  const current = accessLoginFailures.get(key);
  if (!current || current.resetAt <= now) {
    accessLoginFailures.set(key, {
      count: 1,
      resetAt: now + ACCESS_LOGIN_WINDOW_MS,
    });
    return;
  }
  current.count += 1;
}

function clearAccessLoginFailures(req: Request): void {
  accessLoginFailures.delete(getAccessLoginClientKey(req));
}

authSessionRouter.get("/access-session", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    authenticated: hasDashboardAccess(req),
    configured: isDashboardAccessConfigured(),
    expiresInSeconds: DASHBOARD_ACCESS_SESSION_TTL_SECONDS,
  });
});

authSessionRouter.post("/access-session", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");

  if (!isDashboardAccessConfigured()) {
    res.status(503).json({
      error: "Dashboard access password is not configured on the server",
      code: "DASHBOARD_ACCESS_NOT_CONFIGURED",
    });
    return;
  }

  const retryAfterSeconds = readAccessLoginRetryAfterSeconds(req);
  if (retryAfterSeconds > 0) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "Too many failed login attempts",
      code: "DASHBOARD_ACCESS_RATE_LIMITED",
      retryAfterSeconds,
    });
    return;
  }

  if (!isValidDashboardAccessSecret(readSubmittedKey(req))) {
    recordAccessLoginFailure(req);
    res.status(403).json({
      error: "Dashboard access password is invalid",
      code: "DASHBOARD_ACCESS_INVALID",
    });
    return;
  }

  clearAccessLoginFailures(req);
  res.cookie(
    DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    createDashboardAccessSessionToken(),
    {
      httpOnly: true,
      maxAge: DASHBOARD_ACCESS_SESSION_TTL_SECONDS * 1000,
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(req),
    }
  );

  res.status(200).json({
    authenticated: true,
    expiresInSeconds: DASHBOARD_ACCESS_SESSION_TTL_SECONDS,
  });
});

authSessionRouter.delete("/access-session", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.clearCookie(DASHBOARD_ACCESS_SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
  });
  res.clearCookie(WRITE_SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
  });

  res.status(200).json({ authenticated: false });
});

authSessionRouter.get("/write-session", (req: Request, res: Response) => {
  res.status(200).json({
    authenticated: hasValidWriteSession(req),
    configured: isWriteLoginConfigured(),
  });
});

authSessionRouter.post("/write-session", (req: Request, res: Response) => {
  if (!isWriteLoginConfigured()) {
    sendAuthError(res, 503, "WRITE_LOGIN_NOT_CONFIGURED");
    return;
  }

  if (!isValidWriteLoginSecret(readSubmittedKey(req))) {
    sendAuthError(res, 403, "API_KEY_INVALID");
    return;
  }

  res.cookie(WRITE_SESSION_COOKIE_NAME, createWriteSessionToken(), {
    httpOnly: true,
    maxAge: WRITE_SESSION_TTL_SECONDS * 1000,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  });

  res.status(200).json({
    authenticated: true,
    expiresInSeconds: WRITE_SESSION_TTL_SECONDS,
  });
});

authSessionRouter.delete("/write-session", (_req: Request, res: Response) => {
  res.clearCookie(WRITE_SESSION_COOKIE_NAME, {
    path: "/",
    sameSite: "lax",
  });

  res.status(200).json({
    authenticated: false,
  });
});

export { authSessionRouter };
