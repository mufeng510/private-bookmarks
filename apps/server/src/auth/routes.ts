import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { APP_VERSION } from '@private-bookmarks/shared';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { nowIso } from '../db/client.js';
import { users } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { assertSameOrigin } from './origin.js';
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from './plugin.js';
import {
  createSession,
  destroyAllSessions,
  destroyOtherSessions,
  destroySession,
  findSessionUser,
  pruneExpiredSessions,
} from './sessions.js';
import { hashPassword, verifyPassword } from './passwords.js';

const USERNAME_MAX_LENGTH = 64;

export function registerAuthRoutes(app: FastifyInstance, db: Db, config: Config): void {
  // 登录限流：每 IP 5 次 / 5 分钟（可通过 LOGIN_RATE_LIMIT_MAX 配置）
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: config.loginRateLimitMax,
        timeWindow: '5 minutes',
      },
    },
    async handler(request, reply) {
      const origin = request.headers.origin;
      if (origin) assertSameOrigin(origin, config, request);

      const body = request.body as { username?: unknown; password?: unknown } | null;
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!username || !password || username.length > USERNAME_MAX_LENGTH || password.length > 256) {
        // 不区分“用户是否存在”，统一错误信息
        throw AppError.invalidCredentials();
      }

      const user = db.select().from(users).where(eq(users.username, username)).get();
      const ok = user ? await verifyPassword(user.passwordHash, password) : false;
      if (!user || !ok) {
        request.log.info({ username: username.replace(/./g, '*'), outcome: 'failure' }, 'login failure');
        throw AppError.invalidCredentials();
      }

      pruneExpiredSessions(db);
      const session = createSession(db, config, user.id);
      setSessionCookie(reply, config, session.token, session.expiresAt);
      request.log.info({ outcome: 'success' }, 'login success');
      return { username: user.username, version: APP_VERSION };
    },
  });

  app.post('/api/auth/logout', {
    async handler(request, reply) {
      destroySession(db, getSessionToken(request));
      clearSessionCookie(reply, config);
      return { ok: true };
    },
  });

  app.get('/api/auth/session', {
    async handler(request) {
      const user = findSessionUser(db, getSessionToken(request));
      if (!user) throw AppError.authRequired();
      return { username: user.username, version: APP_VERSION };
    },
  });

  app.post('/api/auth/change-password', {
    preHandler: app.requireSession,
    async handler(request) {
      const body = request.body as { currentPassword?: unknown; newPassword?: unknown } | null;
      const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
      if (typeof body?.newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 256) {
        throw AppError.invalidPayload('New password must be 8-256 characters');
      }

      const user = db.select().from(users).where(eq(users.id, request.sessionUser!.id)).get();
      if (!user) throw AppError.authRequired();
      const ok = await verifyPassword(user.passwordHash, currentPassword);
      if (!ok) throw AppError.invalidCredentials('Current password is incorrect');

      const passwordHash = await hashPassword(newPassword);
      db.update(users).set({ passwordHash, updatedAt: nowIso() }).where(eq(users.id, user.id)).run();
      // 其他设备的 Session 全部失效
      destroyOtherSessions(db, user.id, getSessionToken(request));
      request.log.info({ outcome: 'success' }, 'password changed');
      return { ok: true };
    },
  });

  app.post('/api/auth/logout-all', {
    preHandler: app.requireSession,
    async handler(request, reply) {
      const user = request.sessionUser!;
      const destroyed = destroyAllSessions(db, user.id);
      clearSessionCookie(reply, config);
      request.log.info({ destroyed }, 'logged out all devices');
      return { ok: true, destroyed };
    },
  });
}
