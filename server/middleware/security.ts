/**
 * 安全头中间件 — 轻量版 helmet
 */

import type { Request, Response, NextFunction } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // 隐藏服务器指纹
  res.removeHeader('X-Powered-By');

  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 防止 MIME 嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS 过滤
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 限制 Referrer 泄露
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 权限策略：禁用不需要的浏览器功能
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
}
