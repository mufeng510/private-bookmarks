import { randomBytes } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Config } from './config.js';
import type { Db } from './db/client.js';
import { nowIso } from './db/client.js';
import { users } from './db/schema.js';
import { hashPassword } from './auth/passwords.js';

/**
 * 首次启动时创建管理员账号：
 * - ADMIN_PASSWORD 已配置 → 使用配置值
 * - 未配置 → 随机生成并打印到日志（仅一次）
 */
export async function bootstrapAdmin(db: Db, config: Config, log: FastifyBaseLogger): Promise<void> {
  const count = db.select({ n: sql<number>`count(*)` }).from(users).get();
  if (count && count.n > 0) return;

  const password = config.adminPassword ?? randomBytes(16).toString('base64url');
  const passwordHash = await hashPassword(password);

  db.insert(users)
    .values({
      id: randomUUID(),
      username: config.adminUsername,
      passwordHash,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
    .run();

  if (config.adminPassword) {
    log.info(`admin account "${config.adminUsername}" created from ADMIN_PASSWORD`);
  } else {
    log.warn('ADMIN_PASSWORD is not set. Generated random password (shown once, please change it after login):');
    log.warn(`  username: ${config.adminUsername}`);
    log.warn(`  password: ${password}`);
  }
}
