import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

type LoadedAuthModule = typeof import('./auth.js');

type MockResponseState = {
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
  DEV_API?: string;
  NODE_ENV?: string;
}): Promise<LoadedAuthModule> {
  vi.resetModules();
  setEnv('API_SECRET_KEY', env.API_SECRET_KEY);
  setEnv('DEV_API', env.DEV_API);
  setEnv('NODE_ENV', env.NODE_ENV);
  return import('./auth.js');
}

function createMockResponse(): { res: Response; state: MockResponseState } {
  const state: MockResponseState = {
    statusCode: null,
    jsonBody: null,
  };

  const res = {
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
}): Request {
  return {
    method: input.method,
    headers: input.headers ?? {},
    hostname: input.hostname ?? 'example.com',
  } as unknown as Request;
}

afterEach(() => {
  vi.resetModules();
  delete process.env.API_SECRET_KEY;
  delete process.env.DEV_API;
  delete process.env.NODE_ENV;
});

describe('apiKeyAuth', () => {
  it('allows read-only requests without checking the API key', async () => {
    const { apiKeyAuth } = await loadAuthModule({ NODE_ENV: 'production' });
    const req = createMockRequest({ method: 'GET' });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it('allows localhost write requests during local development', async () => {
    const { apiKeyAuth } = await loadAuthModule({ DEV_API: '1', NODE_ENV: 'development' });
    const req = createMockRequest({
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'http://localhost:3000',
      },
      hostname: 'localhost',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });

  it('rejects same-origin-looking production writes without API key', async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: 'expected-key',
      NODE_ENV: 'production',
    });
    const req = createMockRequest({
      method: 'POST',
      headers: {
        host: '120.27.153.140:3000',
        origin: 'http://120.27.153.140:3000',
      },
      hostname: '120.27.153.140',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: 'api key missing or invalid',
      code: 'API_KEY_INVALID',
    });
  });

  it('returns a machine-readable 503 when the write API key is not configured', async () => {
    const { apiKeyAuth } = await loadAuthModule({ NODE_ENV: 'production' });
    const req = createMockRequest({ method: 'POST' });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(503);
    expect(state.jsonBody).toEqual({
      error: 'Write API key is not configured on the server',
      code: 'API_KEY_NOT_CONFIGURED',
    });
  });

  it('rejects invalid write API keys with a machine-readable 403', async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: 'expected-key',
      NODE_ENV: 'production',
    });
    const req = createMockRequest({
      method: 'POST',
      headers: {
        'x-api-key': 'wrong-key',
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: 'api key missing or invalid',
      code: 'API_KEY_INVALID',
    });
  });

  it('allows write requests with the configured API key', async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: 'expected-key',
      NODE_ENV: 'production',
    });
    const req = createMockRequest({
      method: 'PATCH',
      headers: {
        'x-api-key': 'expected-key',
      },
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    apiKeyAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
  });
});
