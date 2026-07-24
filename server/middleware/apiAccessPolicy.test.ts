import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { apiCors } from "./apiCors.js";

type LoadedAuthModule = typeof import("./auth.js");

type MockResponseState = {
  headers: Record<string, string>;
  statusCode: number | null;
  jsonBody: unknown;
};

type MockAppUseCall = {
  path: string;
  handler: RequestHandler;
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

function createMockRequest(input: {
  method: string;
  headers?: Record<string, string | undefined>;
  hostname?: string;
}): Request {
  return {
    method: input.method,
    headers: input.headers ?? {},
    hostname: input.hostname ?? "example.com",
  } as unknown as Request;
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
    sendStatus(code: number) {
      state.statusCode = code;
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

function createMockApp() {
  const calls: MockAppUseCall[] = [];

  return {
    calls,
    app: {
      use(path: string, handler: RequestHandler) {
        calls.push({ path, handler });
      },
    },
  };
}

function runMiddlewarePipeline(
  middlewares: RequestHandler[],
  req: Request,
  res: Response,
  done: NextFunction
): void {
  let index = -1;

  const dispatch = (nextIndex: number): void => {
    if (nextIndex <= index) {
      throw new Error("middleware next() called multiple times");
    }

    index = nextIndex;
    const middleware = middlewares[nextIndex];
    if (!middleware) {
      done();
      return;
    }

    middleware(req, res, () => dispatch(nextIndex + 1));
  };

  dispatch(0);
}

afterEach(() => {
  vi.resetModules();
  delete process.env.API_SECRET_KEY;
  delete process.env.DASHBOARD_WRITE_PASSWORD;
  delete process.env.DASHBOARD_ACCESS_PASSWORD;
  delete process.env.DEV_API;
  delete process.env.NODE_ENV;
});

describe("api access policy pipeline", () => {
  it("allows authenticated dashboard reads without relaxing browser CORS", async () => {
    const {
      apiKeyAuth,
      createDashboardAccessSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "GET",
      headers: {
        origin: "http://untrusted.example",
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}`,
      },
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res,
      done
    );

    expect(done).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(state.headers.Vary).toBeUndefined();
    expect(state.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("still blocks untrusted write requests when the API key is missing", async () => {
    const {
      apiKeyAuth,
      createDashboardAccessSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        origin: "http://untrusted.example",
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}`,
      },
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res,
      done
    );

    expect(done).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
    expect(state.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(state.headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("keeps the Vite proxy loop writable during local development without removing auth middleware", async () => {
    const { apiKeyAuth, dashboardAccessAuth } = await loadAuthModule({
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
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res,
      done
    );

    expect(done).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers["Access-Control-Allow-Origin"]).toBe(
      "http://localhost:3000"
    );
    expect(state.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("requires authorization for trusted browser writes in production even when origin matches host", async () => {
    const {
      apiKeyAuth,
      createDashboardAccessSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "120.27.153.140:3000",
        origin: "http://120.27.153.140:3000",
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}`,
      },
      hostname: "120.27.153.140",
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res,
      done
    );

    expect(done).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: "api key missing or invalid",
      code: "API_KEY_INVALID",
    });
    expect(state.headers["Access-Control-Allow-Origin"]).toBe(
      "http://120.27.153.140:3000"
    );
    expect(state.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("allows trusted browser writes in production with a valid write session cookie", async () => {
    const {
      apiKeyAuth,
      createDashboardAccessSessionToken,
      createWriteSessionToken,
      dashboardAccessAuth,
      DASHBOARD_ACCESS_SESSION_COOKIE_NAME,
      WRITE_SESSION_COOKIE_NAME,
    } = await loadAuthModule({
      API_SECRET_KEY: "expected-key",
      DASHBOARD_ACCESS_PASSWORD: "viewer-password",
      DASHBOARD_WRITE_PASSWORD: "admin-password",
      NODE_ENV: "production",
    });
    const req = createMockRequest({
      method: "POST",
      headers: {
        host: "120.27.153.140:3000",
        origin: "http://120.27.153.140:3000",
        cookie: `${DASHBOARD_ACCESS_SESSION_COOKIE_NAME}=${createDashboardAccessSessionToken()}; ${WRITE_SESSION_COOKIE_NAME}=${createWriteSessionToken()}`,
      },
      hostname: "120.27.153.140",
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline(
      [apiCors, dashboardAccessAuth, apiKeyAuth],
      req,
      res,
      done
    );

    expect(done).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers["Access-Control-Allow-Origin"]).toBe(
      "http://120.27.153.140:3000"
    );
    expect(state.headers["Access-Control-Allow-Credentials"]).toBe("true");
  });
});

describe("registerApiAccessPolicy", () => {
  it("registers all /api policy middlewares on the shared api path", async () => {
    const { apiCors } = await import("./apiCors.js");
    const { apiKeyAuth, dashboardAccessAuth } = await import("./auth.js");
    const { API_ACCESS_POLICY_PATH, registerApiAccessPolicy } = await import(
      "./apiAccessPolicy.js"
    );
    const { app, calls } = createMockApp();

    registerApiAccessPolicy(app);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual({
      path: API_ACCESS_POLICY_PATH,
      handler: apiCors,
    });
    expect(calls[1]).toEqual({
      path: API_ACCESS_POLICY_PATH,
      handler: dashboardAccessAuth,
    });
    expect(calls[2]).toEqual({
      path: API_ACCESS_POLICY_PATH,
      handler: apiKeyAuth,
    });
  });

  it("keeps CORS, dashboard access and write authorization in the required order", async () => {
    const { apiCors } = await import("./apiCors.js");
    const { apiKeyAuth, dashboardAccessAuth } = await import("./auth.js");
    const { registerApiAccessPolicy } = await import("./apiAccessPolicy.js");
    const { app, calls } = createMockApp();

    registerApiAccessPolicy(app);

    expect(calls).toHaveLength(3);
    expect(calls[0]?.handler).toBe(apiCors);
    expect(calls[1]?.handler).toBe(dashboardAccessAuth);
    expect(calls[2]?.handler).toBe(apiKeyAuth);
  });
});
