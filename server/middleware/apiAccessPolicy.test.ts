import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { apiCors } from './apiCors.js';

type LoadedAuthModule = typeof import('./auth.js');

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
  DEV_API?: string;
  NODE_ENV?: string;
}): Promise<LoadedAuthModule> {
  vi.resetModules();
  setEnv('API_SECRET_KEY', env.API_SECRET_KEY);
  setEnv('DEV_API', env.DEV_API);
  setEnv('NODE_ENV', env.NODE_ENV);
  return import('./auth.js');
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

function runMiddlewarePipeline(
  middlewares: RequestHandler[],
  req: Request,
  res: Response,
  done: NextFunction,
): void {
  let index = -1;

  const dispatch = (nextIndex: number): void => {
    if (nextIndex <= index) {
      throw new Error('middleware next() called multiple times');
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
  delete process.env.DEV_API;
  delete process.env.NODE_ENV;
});

describe('api access policy pipeline', () => {
  it('keeps public GET access for untrusted origins without granting credentials', async () => {
    const { apiKeyAuth } = await loadAuthModule({ NODE_ENV: 'production' });
    const req = createMockRequest({
      method: 'GET',
      headers: {
        origin: 'http://untrusted.example',
      },
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline([apiCors, apiKeyAuth], req, res, done);

    expect(done).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://untrusted.example');
    expect(state.headers.Vary).toBe('Origin');
    expect(state.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('still blocks untrusted write requests when the API key is missing', async () => {
    const { apiKeyAuth } = await loadAuthModule({
      API_SECRET_KEY: 'expected-key',
      NODE_ENV: 'production',
    });
    const req = createMockRequest({
      method: 'POST',
      headers: {
        origin: 'http://untrusted.example',
      },
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline([apiCors, apiKeyAuth], req, res, done);

    expect(done).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(403);
    expect(state.jsonBody).toEqual({
      error: 'api key missing or invalid',
      code: 'API_KEY_INVALID',
    });
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://untrusted.example');
    expect(state.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('keeps the Vite proxy loop writable during local development without removing auth middleware', async () => {
    const { apiKeyAuth } = await loadAuthModule({
      DEV_API: '1',
      NODE_ENV: 'development',
    });
    const req = createMockRequest({
      method: 'POST',
      headers: {
        host: 'localhost:3001',
        origin: 'http://localhost:3000',
      },
      hostname: 'localhost',
    });
    const { res, state } = createMockResponse();
    const done = vi.fn<NextFunction>();

    runMiddlewarePipeline([apiCors, apiKeyAuth], req, res, done);

    expect(done).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(state.headers['Access-Control-Allow-Credentials']).toBe('true');
  });
});
