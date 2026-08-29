import type { FastifyInstance } from 'fastify';
import { eq, isNotNull } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { bookmarks, syncState } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { countNodes } from '../sync/service.js';
import { listLiveNodes, searchNodes, toNode } from './tree.js';

function parseClientParam(query: Record<string, unknown>): string | undefined {
  const client = query['client'];
  if (typeof client !== 'string' || client === '' || client === 'all') return undefined;
  return client.slice(0, 128);
}

function clientSummaries(db: Db) {
  const states = db.select().from(syncState).all();
  return states.map((state) => ({
    clientId: state.clientId,
    lastSyncAt: state.lastSyncAt,
    lastFullSyncAt: state.lastFullSyncAt,
    syncVersion: state.syncVersion,
    bookmarkCount: countNodes(db, state.clientId, 'bookmark'),
  }));
}

export function registerBookmarkRoutes(app: FastifyInstance, db: Db): void {
  // 全量书签数据（仅登录后可访问；未授权一律 401，绝不返回书签数据）
  app.get('/api/bookmarks', {
    preHandler: app.requireSession,
    async handler(request) {
      const clientId = parseClientParam(request.query as Record<string, unknown>);
      const nodes = listLiveNodes(db, clientId);
      return {
        clients: clientSummaries(db),
        client: clientId ?? 'all',
        nodes: nodes.map(toNode),
      };
    },
  });

  // 服务器端搜索，绝不把全部书签发给未认证客户端
  app.get('/api/bookmarks/search', {
    preHandler: app.requireSession,
    async handler(request) {
      const query = request.query as Record<string, unknown>;
      const q = typeof query['q'] === 'string' ? query['q'] : '';
      const clientId = parseClientParam(query);
      const nodes = listLiveNodes(db, clientId);
      const results = searchNodes(nodes, q).map((row) => ({
        id: row.id,
        clientId: row.clientId,
        remoteId: row.remoteId,
        type: row.type as 'bookmark' | 'folder',
        title: row.title,
        url: row.url,
        faviconUrl: row.faviconUrl,
        folderPath: row.folderPath,
      }));
      return { query: q, results };
    },
  });

  app.get('/api/bookmarks/:id', {
    preHandler: app.requireSession,
    async handler(request) {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id <= 0) throw AppError.notFound('Bookmark not found');
      const live = db.select().from(bookmarks).where(eq(bookmarks.id, id)).get();
      if (!live || live.deletedAt) throw AppError.notFound('Bookmark not found');
      return toNode(live);
    },
  });

  // 手动永久清理软删除书签（设置页"清理已删除书签"）
  app.post('/api/bookmarks/purge-deleted', {
    preHandler: app.requireSession,
    async handler(request) {
      const result = db.delete(bookmarks).where(isNotNull(bookmarks.deletedAt)).run();
      request.log.info({ purged: result.changes }, 'purged deleted bookmarks');
      return { purged: result.changes };
    },
  });
}
