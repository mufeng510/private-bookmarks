import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config.js';
import { AppError } from '../lib/errors.js';

/**
 * CSRF 防护：对使用 Cookie 认证的状态修改请求做 Origin/Referer 校验。
 * 允许：无 Origin（非浏览器客户端/curl）、与 baseUrl 或请求 Host 同源的 Origin、
 * 以及 ALLOWED_ORIGINS 中显式配置的来源。
 */
export function assertSameOrigin(origin: string | undefined, config: Config, request: FastifyRequest): void {
  if (!origin) return;

  const allowed = new Set<string>(config.allowedOrigins);
  if (config.baseUrl) {
    try {
      allowed.add(new URL(config.baseUrl).origin);
    } catch {
      // baseUrl 配置非法时忽略
    }
  }
  const host = request.headers.host;
  if (host) {
    const proto = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
    allowed.add(`${proto}://${host}`);
  }

  if (allowed.has(origin)) return;

  // Referer 兜底（某些请求只带 Referer）
  const referer = request.headers.referer;
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) return;
    } catch {
      // ignore
    }
  }

  request.log.warn({ origin }, 'blocked cross-origin state-changing request');
  throw AppError.forbiddenOrigin();
}

/** 从请求中提取 Origin，供 CORS 判断 */
export function requestOrigin(request: FastifyRequest): string | null {
  const origin = request.headers.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : null;
}

export function setNoStoreHeaders(reply: FastifyReply): void {
  reply.header('Cache-Control', 'no-store');
}
