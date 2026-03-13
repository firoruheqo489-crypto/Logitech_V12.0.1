/**
 * API 请求工具 — 全量注入 x-api-key
 */

const API_KEY = import.meta.env.VITE_API_KEY || '';

/** 带认证的 fetch，所有请求自动注入 x-api-key */
export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (API_KEY) {
    headers.set('x-api-key', API_KEY);
  }

  return fetch(url, { ...init, headers });
}
