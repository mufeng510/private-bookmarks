import type { FastifyReply, FastifyInstance, FastifyRequest } from 'fastify';
import { SESSION_COOKIE_NAME } from '@private-bookmarks/shared';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { AppError } from '../lib/errors.js';
import { assertSameOrigin } from './origin.js';
import { findSessionUser, type SessionUser } from './sessions.js';
import { verifySyncToken, type SyncTokenRow } from '../sync/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Cookie Session 认证后的当前用户（requireSession 后可用） */
    sessionUser?: SessionUser;
    /** Bearer Sync Token 认证后的 token 记录（requireSyncToken 后可用） */
    syncTokenRow?: SyncTokenRow;
  }
}

/** 读取并验签 Session Cookie，返回原始 token（无效返回 undefined） */
export function getSessionToken(request: FastifyRequest): string | undefined {
  const raw = request.cookies[SESSION_COOKIE_NAME];
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : undefined;
}

/**
 * Session 认证。对状态修改请求（非 GET/HEAD）同时做 Origin 校验防 CSRF。
 */
export function requireSession(db: Db, config: Config) {
  return async function requireSession(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const rawCookie = request.cookies[SESSION_COOKIE_NAME];
    const token = getSessionToken(request);
    const user = findSessionUser(db, token);
    if (!user) {
      if (rawCookie) {
        // Cookie 存在但签名无效或 Session 已过期/失效
        throw AppError.sessionExpired();
      }
      throw AppError.authRequired();
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      assertSameOrigin(request.headers.origin, config, request);
    }
    request.sessionUser = user;
  };
}

/** Sync API 认证：只接受 Authorization: Bearer <SYNC_TOKEN>，网站 Session 不能替代 */
export function requireSyncToken(db: Db) {
  return async function requireSyncToken(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    request.syncTokenRow = verifySyncToken(db, request.headers.authorization);
  };
}

export function setSessionCookie(reply: FastifyReply, config: Config, token: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    secure: config.baseUrl.startsWith('https://'),
    sameSite: 'lax',
    expires: expiresAt,
    signed: true,
  });
  reply.header('Cache-Control', 'no-store');
}

export function clearSessionCookie(reply: FastifyReply, config: Config): void {
  reply.clearCookie(SESSION_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: config.baseUrl.startsWith('https://'),
    sameSite: 'lax',
    signed: true,
  });
}

export function registerAuthDecorators(app: FastifyInstance, db: Db, config: Config): void {
  app.decorate('requireSession', requireSession(db, config));
  app.decorate('requireSyncToken', requireSyncToken(db));
}

declare module 'fastify' {
  interface FastifyInstance {
    requireSession: ReturnType<typeof requireSession>;
    requireSyncToken: ReturnType<typeof requireSyncToken>;
  }
}
