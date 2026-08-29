import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import type { SyncRequest } from '@private-bookmarks/sync-protocol';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { syncState } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { applySync, countDeleted, countNodes } from './service.js';

export function registerSyncRoutes(app: FastifyInstance, db: Db, config: Config): void {
  // Sync API：只允许 Bearer Sync Token，网站 Session 不能替代
  app.post('/api/sync', {
    preHandler: app.requireSyncToken,
    config: {
      rateLimit: {
        max: config.syncRateLimitPerMinute,
        timeWindow: '1 minute',
        keyGenerator(request) {
          return request.syncTokenRow?.id ?? request.ip;
        },
      },
    },
    async handler(request) {
      const payload = request.body as SyncRequest | null;
      if (!payload || typeof payload !== 'object') {
        throw AppError.invalidPayload('JSON body required');
      }
      return applySync(db, payload);
    },
  });

  // Token 连通性验证（扩展设置页"测试连接"）
  app.get('/api/sync/ping', {
    preHandler: app.requireSyncToken,
    async handler(request) {
      return { ok: true as const, clientId: request.syncTokenRow!.id };
    },
  });

  // 同步状态（网站设置页，Session 认证）
  app.get('/api/sync/status', {
    preHandler: app.requireSession,
    async handler() {
      const states = db.select().from(syncState).orderBy(desc(syncState.lastSyncAt)).all();
      return {
        clients: states.map((state) => ({
          clientId: state.clientId,
          lastSyncAt: state.lastSyncAt,
          lastFullSyncAt: state.lastFullSyncAt,
          syncVersion: state.syncVersion,
          bookmarkCount: countNodes(db, state.clientId, 'bookmark'),
        })),
        totalBookmarks: countNodes(db, undefined, 'bookmark'),
        totalDeleted: countDeleted(db),
      };
    },
  });
}
