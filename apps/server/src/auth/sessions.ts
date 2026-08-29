import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Config } from '../config.js';
import type { Db } from '../db/client.js';
import { nowIso } from '../db/client.js';
import { sessions, users } from '../db/schema.js';

export interface SessionUser {
  id: string;
  username: string;
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** 为用户创建新 Session，返回明文 token（只出现在 Set-Cookie 中） */
export function createSession(db: Db, config: Config, userId: string): CreatedSession {
  const token = generateSessionToken();
  const tokenHash = sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlDays * 24 * 60 * 60 * 1000);

  db.insert(sessions)
    .values({
      id: tokenHash,
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
    })
    .run();

  return { token, expiresAt };
}

/** 通过 Cookie 中的原始 token 查找有效 Session */
export function findSessionUser(db: Db, token: string | undefined): SessionUser | null {
  if (!token) return null;
  const tokenHash = sha256(token);
  const nowIsoStr = nowIso();

  const row = db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, id: sessions.id, lastUsedAt: sessions.lastUsedAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, nowIsoStr)))
    .get();

  if (!row) return null;

  // 节流更新 lastUsedAt（1 小时内不重复写）
  if (Date.now() - new Date(row.lastUsedAt).getTime() > 60 * 60 * 1000) {
    db.update(sessions).set({ lastUsedAt: nowIsoStr }).where(eq(sessions.id, row.id)).run();
  }

  const user = db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, row.userId)).get();
  return user ?? null;
}

export function destroySession(db: Db, token: string | undefined): void {
  if (!token) return;
  db.delete(sessions).where(eq(sessions.tokenHash, sha256(token))).run();
}

export function destroyAllSessions(db: Db, userId: string, exceptTokenHash?: string): number {
  if (exceptTokenHash) {
    const result = db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), sql`${sessions.tokenHash} != ${exceptTokenHash}`))
      .run();
    return result.changes;
  }
  const result = db.delete(sessions).where(eq(sessions.userId, userId)).run();
  return result.changes;
}

/** 修改密码后调用：使用户在其他设备上的全部 Session 失效 */
export function destroyOtherSessions(db: Db, userId: string, keepToken: string | undefined): number {
  return destroyAllSessions(db, userId, keepToken ? sha256(keepToken) : undefined);
}

/** 清理已过期的 Session（每次登录时顺带执行） */
export function pruneExpiredSessions(db: Db): void {
  db.delete(sessions).where(lt(sessions.expiresAt, nowIso())).run();
}
