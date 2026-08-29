import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client.js';
import { nowIso } from '../db/client.js';
import { appSettings, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/errors.js';
import { createSyncToken, listSyncTokens, revokeSyncToken } from '../sync/tokens.js';
import { countDeleted, countNodes } from '../sync/service.js';
import { getSessionToken } from '../auth/plugin.js';
import { sha256 } from '../auth/sessions.js';

const ALLOWED_PREF_KEYS = new Set(['theme', 'defaultClientId']);
const MAX_PREF_VALUE_LENGTH = 128;

export function registerSettingsRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/settings', {
    preHandler: app.requireSession,
    async handler(request) {
      const user = db
        .select({ id: users.id, username: users.username, createdAt: users.createdAt })
        .from(users)
        .where(eq(users.id, request.sessionUser!.id))
        .get();
      const prefs: Record<string, string> = {};
      for (const row of db.select().from(appSettings).all()) {
        prefs[row.key] = row.value;
      }
      return {
        username: user?.username ?? null,
        createdAt: user?.createdAt ?? null,
        prefs,
        stats: {
          totalBookmarks: countNodes(db, undefined, 'bookmark'),
          totalDeleted: countDeleted(db),
        },
      };
    },
  });

  app.post('/api/settings', {
    preHandler: app.requireSession,
    async handler(request) {
      const body = request.body as { prefs?: unknown } | null;
      if (!body || typeof body.prefs !== 'object' || body.prefs === null) {
        throw AppError.invalidPayload('prefs object is required');
      }
      for (const [key, value] of Object.entries(body.prefs as Record<string, unknown>)) {
        if (!ALLOWED_PREF_KEYS.has(key)) continue; // 未知键忽略
        if (typeof value !== 'string' || value.length > MAX_PREF_VALUE_LENGTH) {
          throw AppError.invalidPayload(`invalid value for pref "${key}"`);
        }
        db.insert(appSettings)
          .values({ key, value, updatedAt: nowIso() })
          .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: nowIso() } })
          .run();
      }
      return { ok: true };
    },
  });

  // ---- Sync Token 管理（与网站密码完全分离）----

  app.get('/api/sync-tokens', {
    preHandler: app.requireSession,
    async handler() {
      return { tokens: listSyncTokens(db) };
    },
  });

  app.post('/api/sync-tokens', {
    preHandler: app.requireSession,
    async handler(request) {
      const body = request.body as { name?: unknown } | null;
      const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 64) : '默认 Token';
      const created = createSyncToken(db, name);
      request.log.info({ tokenId: created.id }, 'sync token created');
      // 明文 token 只在创建时返回一次
      return { id: created.id, name: created.name, prefix: created.prefix, createdAt: created.createdAt, token: created.token };
    },
  });

  app.delete('/api/sync-tokens/:id', {
    preHandler: app.requireSession,
    async handler(request) {
      const id = (request.params as { id: string }).id;
      const revoked = revokeSyncToken(db, id);
      if (!revoked) throw AppError.notFound('Token not found or already revoked');
      request.log.info({ tokenId: sha256(id).slice(0, 8) }, 'sync token revoked');
      return { ok: true };
    },
  });

  // 当前登录用户信息（Session 便捷校验）
  app.get('/api/me', {
    preHandler: app.requireSession,
    async handler(request) {
      return { username: request.sessionUser!.username };
    },
  });

  void getSessionToken;
}
