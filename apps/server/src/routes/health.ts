import type { FastifyInstance, FastifyReply } from 'fastify';
import { sql } from 'drizzle-orm';
import { APP_VERSION } from '@private-bookmarks/shared';
import type { Db } from '../db/client.js';

export function registerHealthRoute(app: FastifyInstance, db: Db): void {
  app.get('/api/health', {
    logLevel: 'silent',
    async handler(_request, reply: FastifyReply) {
      let database = 'ok';
      try {
        db.get(sql`SELECT 1`);
      } catch {
        database = 'error';
      }
      const status = database === 'ok' ? 'ok' : 'degraded';
      reply.code(database === 'ok' ? 200 : 503);
      return { status, version: APP_VERSION, database };
    },
  });
}
