import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

type LoadedAuthModule = typeof import("./auth.js");

type MockResponseState = {
  headers: Record<string, string>;
  statusCode: number | null;
  jsonBody: unknown;
};

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function loadAuthModule(env: {
  API_SECRET_KEY?: string;
  DASHBOARD_WRITE_PASSWORD?: string;
  DASHBOARD_ACCESS_PASSWORD?: string;
  DEV_API?: string;
  NODE_ENV?: string;
}): Promise<LoadedAuthModule> {
  vi.resetModules();
  setEnv("API_SECRET_KEY", env.API_SECRET_KEY);
  setEnv("DASHBOARD_WRITE_PASSWORD", env.DASHBOARD_WRITE_PASSWORD);
  setEnv("DASHBOARD_ACCESS_PASSWORD", env.DASHBOARD_ACCESS_PASSWORD);
  setEnv("DEV_API", env.DEV_API);
  setEnv("NODE_ENV", env.NODE_ENV);
  return import("./auth.js");
}

function createMockResponse(): { res: Response; state: MockResponseState } {
  const state: MockResponseState = {
    headers: {},
    statusCode: null,
    jsonBody: null,
  };

  const res = {
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return this;
    },
  } as unknown as Response;

  return { res, state };
}

function createMockRequest(input: {
  method: string;
  headers?: Record<string, string | undefined>;
  hostname?: string;
  path?: string;
  baseUrl?: string;
  originalUrl?: string;
}): Request {
  return {
    method: input.method,
    headers: input.headers ?? {},
    hostname: input.hostname ?? "example.com",
    path: input.path ?? "/",
    baseUrl: input.baseUrl ?? "",
    originalUrl: input.originalUrl ?? input.path ?? "/",
  } as unknown as Request;
}

afterEach(() => {
  vi.resetModules();
  delete process.env.API_SECRET_KEY;
  delete process.env.DASHBOARD_WRITE_PASSWORD;
  delete process.env.DASHBOARD_ACCESS_PASSWORD;
  delete process.env.DEV_API;
  delete process.env.NODE_ENV;
});

describe("apiKeyAuth", () => {
  it("allows read-only requests without checking the API key", async () => {
    const { apiKeyAuth } = await loadAuthModule({ NODE_ENV: "production" });
    const req = createMockRequest({ method: "GET" });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("allows localhost write requests during local development", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      DEV_API: "1",
      NODE_ENV: "development",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:3000",
      },
      hostname: "localhost",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("does not allow the local development bypass in production", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DEV_API: "1",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:3000",
      },
      hostname: "localhost",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
  });

  it("rejects same-origin-looking production writes without API key", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "120.27.153.140:3000",
        origin: "http://120.27.153.140:3000",
      },
      hostname: "120.27.153.140",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
  });

  it("returns a machine-readable 503 when the write API key is not configured", async () => {
    const { apiKeyAuth } = await loadAuthModule({ NODE_ENV: "production" });
    const req = createMockRequest({ method: "POST" });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(503);
    expect(state.jsonBody).toEqual({
      error: "Write API key is not configured on the server",
      code: "API_KEY_NOT_CONFIGURED",
    });
  });

  it("rejects invalid write API keys with a machine-readable 403", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        "x-api-key": "wrong-key",
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
  });

  it("allows write requests with the configured API key", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "PATCH",
      headers: {
        "x-api-key": "expected-key",
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("requires the dedicated dashboard password for browser login without changing the legacy API key", async () => {
    const {
      isValidWriteApiKey,
      isValidWriteLoginSecret,
      isWriteLoginConfigured,
    } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_WRITE_PASSWORD: "admin-password",
      NODE_ENV: "production",
    });

    expect(isWriteLoginConfigured()).toBe(true);
    expect(isValidWriteLoginSecret("admin-password")).toBe(true);
    expect(isValidWriteLoginSecret("expected-key")).toBe(false);
    expect(isValidWriteApiKey("admin-password")).toBe(false);
    expect(isValidWriteApiKey("expected-key")).toBe(true);
  });

  it("keeps browser administrator login disabled when no dedicated password is configured", async () => {
    const { isValidWriteLoginSecret, isWriteLoginConfigured } =
      await loadAuthModule({
        API_SECRET_KEY: "expected-key",
        NODE_ENV: "production",
      });

    expect(isWriteLoginConfigured()).toBe(false);
    expect(isValidWriteLoginSecret("expected-key")).toBe(false);
  });

  it("allows write requests with a valid HttpOnly session cookie", async () => {
    const { apiKeyAuth, createWriteSessionToken, WRITE_SESSION_COOKIE_NAME } =
      await loadAuthModule({
        API_SECRET_KEY: "expected-key",
        NODE_ENV: "production",
      });
    const req = createMockRequest({
      method: "POST",
      headers: {
        cookie: `${WRITE_SESSION_COOKIE_NAME}=${createWriteSessionToken()}`,
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("rejects tampered write session cookies", async () => {
    const { apiKeyAuth, createWriteSessionToken, WRITE_SESSION_COOKIE_NAME } =
      await loadAuthModule({
        API_SECRET_KEY: "expected-key",
        NODE_ENV: "production",
      });
    const tokenParts = createWriteSessionToken().split(".");
    tokenParts[3] = tokenParts[3] === "tampered" ? "invalid" : "tampered";
    const token = tokenParts.join(".");
    const req = createMockRequest({
      method: "POST",
      headers: {
        cookie: `${WRITE_SESSION_COOKIE_NAME}=${token}`,
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
  });

  it("invalidates existing browser sessions when the administrator password changes", async () => {
    const originalAuth = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_WRITE_PASSWORD: "old-admin-password",
      NODE_ENV: "production",
    });
    const token = originalAuth.createWriteSessionToken();
    expect(originalAuth.isValidWriteSessionToken(token)).toBe(true);

    const rotatedAuth = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_WRITE_PASSWORD: "new-admin-password",
      NODE_ENV: "production",
    });
    expect(rotatedAuth.isValidWriteSessionToken(token)).toBe(false);
  });

  it("allows the write-session login endpoint without an existing session", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      baseUrl: "/api",
      path: "/auth/write-session",
      originalUrl: "/api/auth/write-session",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("allows the access-session login endpoint through the write authorization layer", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      baseUrl: "/api",
      path: "/auth/access-session",
      originalUrl: "/api/auth/access-session",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("allows the presigned preview endpoint as a public read operation", async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      baseUrl: "/api",
      path: "/storage/presigned-url/preview-url",
      originalUrl: "/api/storage/presigned-url/preview-url",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });
});

describe("dashboardAccessAuth", () => {
  it("fails closed in production when the dashboard access password is missing", async () => {
    const { dashboardAccessAuth } = await loadAuthModule({
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "GET",
      path: "/dashboard/projects",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    dashboardAccessAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(503);
    expect(state.headers["Cache-Control"]).toBe("no-store");
    expect(state.jsonBody).toEqual({
      error: "Dashboard access password is not configured on the server",
      code: "DASHBOARD_ACCESS_NOT_CONFIGURED",
    });
  });

  it("requires a login session for production dashboard reads", async () => {
    const { dashboardAccessAuth } = await loadAuthModule({
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "GET",
      path: "/dashboard/projects",
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    dashboardAccessAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(401);
    expect(state.jsonBody).toEqual({
      error: "Dashboard login is required",
      code: "DASHBOARD_ACCESS_REQUIRED",
    });
  });

  it("allows reads with a valid dashboard access session cookie", async () => {
    const {
      createDashboardAccessSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "GET",
      path: "/dashboard/projects",
      headers: {
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}`,
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    dashboardAccessAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("invalidates viewer sessions when the access password changes", async () => {
    const originalAuth = await loadAuthModule({
      API_SECRET_KEY: "machine-key",
      DASHBOARD_ACCESS_PASSWORD: "old-viewer-password",
      NODE_ENV: "production",
    });
    const token = originalAuth.createDashboardAccessSessionToken();
    expect(originalAuth.isValidDashboardAccessSessionToken(token)).toBe(true);

    const rotatedAuth = await loadAuthModule({
      API_SECRET_KEY: "machine-key",
      DASHBOARD_ACCESS_PASSWORD: "new-viewer-password",
      NODE_ENV: "production",
    });
    expect(rotatedAuth.isValidDashboardAccessSessionToken(token)).toBe(false);
  });

  it("keeps health, release and access-session endpoints public", async () => {
    const { dashboardAccessAuth } = await loadAuthModule({
      NODE_ENV: "production",
    });
    const publicPaths = [
      "/api/health",
      "/api/release",
      "/api/auth/access-session",
    ];

    for (const originalUrl of publicPaths) {
      const req = createMockRequest({
        method: "GET",
        baseUrl: "/api",
        path: originalUrl.replace("/api", ""),
        originalUrl,
      });
      const { res, state } = createMockResponse();
      const next = vi.fn<NextFunction>();

      dashboardAccessAuth(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(state.statusCode).toBeNull();
    }
  });

  it("allows machine API clients with the configured API key", async () => {
    const { dashboardAccessAuth } = await loadAuthModule({
      API_SECRET_KEY: "machine-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "GET",
      path: "/dashboard/projects",
      headers: { "x-api-key": "machine-key" },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    dashboardAccessAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it("keeps localhost readable during DEV_API development", async () => {
    const { dashboardAccessAuth } = await loadAuthModule({
      DEV_API: "1",
      NODE_ENV: "development",
    });
    const req = createMockRequest({
      method: "GET",
      path: "/dashboard/projects",
      hostname: "localhost",
      headers: { host: "localhost:3001", origin: "http://localhost:3000" },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    dashboardAccessAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });
});
