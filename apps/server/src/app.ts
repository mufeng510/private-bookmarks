import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { createDatabase, type DatabaseHandle } from './db/client.js';
import { AppError } from './lib/errors.js';
import { registerAuthDecorators } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerBookmarkRoutes } from './bookmarks/routes.js';
import { registerSyncRoutes } from './sync/routes.js';
import { registerSettingsRoutes } from './settings/routes.js';
import { registerImportExportRoutes } from './import-export/routes.js';
import { registerHealthRoute } from './routes/health.js';
import { registerSecurity } from './plugins/security.js';
import { bootstrapAdmin } from './bootstrap.js';

export interface AppOptions {
  migrationsFolder?: string;
  logger?: boolean | Record<string, unknown>;
}

export interface BuiltApp {
  app: FastifyInstance;
  handle: DatabaseHandle;
  close(): Promise<void>;
}

export async function buildApp(config: Config, options: AppOptions = {}): Promise<BuiltApp> {
  const handle = createDatabase(config.databaseUrl, options.migrationsFolder);
  const { db } = handle;

  const app = Fastify({
    logger:
      options.logger ?? {
        level: config.logLevel,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
          censor: '[REDACTED]',
        },
        // 日志中绝不出现书签数据与任何 Token/Cookie/密码字段
        autoLogging: {
          ignore: (req: { url?: string }) => req.url === '/api/health' || req.url === '/robots.txt',
        },
      },
    bodyLimit: 50 * 1024 * 1024, // 全量同步与导入的 JSON 可能较大
    trustProxy: config.trustProxy,
    genReqId: () => randomUUID(),
  });

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, { global: false });
  await app.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 1,
    },
  });

  registerSecurity(app, config);
  registerAuthDecorators(app, db, config);
  registerHealthRoute(app, db);
  registerAuthRoutes(app, db, config);
  registerBookmarkRoutes(app, db);
  registerSyncRoutes(app, db, config);
  registerSettingsRoutes(app, db);
  registerImportExportRoutes(app, db);

  // 统一错误格式：{ error: { code, message } }，不暴露数据库堆栈
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
      return;
    }
    if (error.statusCode === 429) {
      reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try later' } });
      return;
    }
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send({ error: { code: 'INVALID_PAYLOAD', message: 'Invalid request' } });
      return;
    }
    request.log.error(error);
    reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
  });

  // 静态资源（Web 构建产物）+ SPA fallback
  const webDist = config.webDist;
  if (webDist && existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: path.resolve(webDist),
      index: 'index.html',
      maxAge: '1h',
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
      }
      if (request.method === 'GET' || request.method === 'HEAD') {
        // /login /bookmarks /settings 等前端路由回退到 index.html
        reply.type('text/html; charset=utf-8').sendFile('index.html');
        return;
      }
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
  } else {
    app.setNotFoundHandler((request, reply) => {
      reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    });
  }

  await bootstrapAdmin(db, config, app.log);

  return {
    app,
    handle,
    async close() {
      await app.close();
      handle.close();
    },
  };
}
