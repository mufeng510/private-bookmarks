import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import type { SyncRequest } from '@private-bookmarks/sync-protocol';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { syncState } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { applySync, countDeleted, countNodes, deleteClientData, getSyncState, RESERVED_CLIENT_ID } from './service.js';

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
      // 扩展同步不允许使用导入命名空间的保留标识（内部导入服务不受此限制）
      if (payload.clientId === RESERVED_CLIENT_ID) {
        throw AppError.invalidPayload(`clientId "${RESERVED_CLIENT_ID}" is reserved`);
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

  // 删除某台设备的全部同步数据（重装系统/更换设备标识后清理旧数据，Session 认证）
  app.delete('/api/clients/:clientId', {
    preHandler: app.requireSession,
    async handler(request) {
      const clientId = (request.params as { clientId: string }).clientId;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(clientId)) {
        throw AppError.invalidPayload('invalid clientId');
      }
      if (!getSyncState(db, clientId)) {
        throw AppError.notFound('Client not found');
      }
      const result = deleteClientData(db, clientId);
      request.log.info({ clientId, deleted: result.bookmarks }, 'client data deleted');
      return { ok: true, ...result };
    },
  });
}
