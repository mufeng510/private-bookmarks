import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { SYNC_TOKEN_PREFIX } from '@private-bookmarks/shared';
import type { Db } from '../db/client.js';
import { nowIso } from '../db/client.js';
import { syncTokens } from '../db/schema.js';
import { AppError } from '../lib/errors.js';

export interface SyncTokenRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedSyncToken extends SyncTokenRow {
  /** 明文 token 只在创建时返回一次 */
  token: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  // 32 字节随机 → base64url，约 43 字符
  return `${SYNC_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function createSyncToken(db: Db, name: string): CreatedSyncToken {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const row: SyncTokenRow = {
    id: randomBytes(12).toString('hex'),
    name,
    // 展示前缀：BM_ + 前 6 个字符，不泄露完整 token
    prefix: token.slice(0, SYNC_TOKEN_PREFIX.length + 6),
    lastUsedAt: null,
    createdAt: nowIso(),
    revokedAt: null,
  };
  db.insert(syncTokens)
    .values({ ...row, tokenHash })
    .run();
  return { ...row, token };
}

/** 通过 Bearer token 校验；返回 token 记录，无效抛 401 */
export function verifySyncToken(db: Db, authorization: string | undefined): SyncTokenRow {
  if (!authorization?.startsWith('Bearer ')) {
    throw AppError.invalidSyncToken();
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw AppError.invalidSyncToken();

  const tokenHash = hashToken(token);
  const row = db.select().from(syncTokens).where(eq(syncTokens.tokenHash, tokenHash)).get();
  if (!row) throw AppError.invalidSyncToken();
  if (row.revokedAt) throw AppError.tokenRevoked();

  // 节流更新 lastUsedAt
  if (!row.lastUsedAt || Date.now() - new Date(row.lastUsedAt).getTime() > 60 * 1000) {
    db.update(syncTokens).set({ lastUsedAt: nowIso() }).where(eq(syncTokens.id, row.id)).run();
  }

  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

export function listSyncTokens(db: Db): SyncTokenRow[] {
  return db
    .select({
      id: syncTokens.id,
      name: syncTokens.name,
      prefix: syncTokens.prefix,
      lastUsedAt: syncTokens.lastUsedAt,
      createdAt: syncTokens.createdAt,
      revokedAt: syncTokens.revokedAt,
    })
    .from(syncTokens)
    .where(isNull(syncTokens.revokedAt))
    .orderBy(sql`${syncTokens.createdAt} DESC`)
    .all();
}

export function revokeSyncToken(db: Db, id: string): boolean {
  const result = db.update(syncTokens).set({ revokedAt: nowIso() }).where(and(eq(syncTokens.id, id), isNull(syncTokens.revokedAt))).run();
  return result.changes > 0;
}
