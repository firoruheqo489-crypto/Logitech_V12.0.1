import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createApiCorsMiddleware } from './apiCors.js';

type MockResponseState = {
  headers: Record<string, string>;
  statusCode: number | null;
};

function createMockRequest(input: {
  method: string;
  origin?: string;
}): Request {
  return {
    method: input.method,
    headers: input.origin ? { origin: input.origin } : {},
  } as unknown as Request;
}

function createMockResponse(): { res: Response; state: MockResponseState } {
  const state: MockResponseState = {
    headers: {},
    statusCode: null,
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
  } as unknown as Response;

  return { res, state };
}

describe('createApiCorsMiddleware', () => {
  const middleware = createApiCorsMiddleware(new Set(['http://trusted.example']));

  it('allows trusted write preflight requests', () => {
    const req = createMockRequest({
      method: 'OPTIONS',
      origin: 'http://trusted.example',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(204);
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://trusted.example');
    expect(state.headers.Vary).toBe('Origin');
    expect(state.headers['Access-Control-Allow-Methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS');
    expect(state.headers['Access-Control-Allow-Headers']).toBe('Content-Type, x-api-key');
    expect(state.headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('downgrades untrusted preflight requests to public read methods only', () => {
    const req = createMockRequest({
      method: 'OPTIONS',
      origin: 'http://untrusted.example',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(204);
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://untrusted.example');
    expect(state.headers.Vary).toBe('Origin');
    expect(state.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(state.headers['Access-Control-Allow-Headers']).toBeUndefined();
    expect(state.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('keeps origin-less preflight requests cache-safe with a wildcard origin', () => {
    const req = createMockRequest({ method: 'OPTIONS' });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(state.statusCode).toBe(204);
    expect(state.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(state.headers.Vary).toBeUndefined();
    expect(state.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
  });

  it('adds credentials only for trusted cross-origin requests', () => {
    const req = createMockRequest({
      method: 'GET',
      origin: 'http://trusted.example',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://trusted.example');
    expect(state.headers.Vary).toBe('Origin');
    expect(state.headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('keeps public GET access for untrusted origins without credentials', () => {
    const req = createMockRequest({
      method: 'GET',
      origin: 'http://untrusted.example',
    });
    const { res, state } = createMockResponse();
    const next = vi.fn<NextFunction>();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeNull();
    expect(state.headers['Access-Control-Allow-Origin']).toBe('http://untrusted.example');
    expect(state.headers.Vary).toBe('Origin');
    expect(state.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });
});
