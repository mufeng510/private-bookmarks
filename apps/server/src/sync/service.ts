import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import type { SyncChange, SyncMode, SyncRequest, SyncResponse, SyncStats } from '@private-bookmarks/sync-protocol';
import { faviconForUrl, isSafeUrl } from '@private-bookmarks/shared';
import type { Db } from '../db/client.js';
import { nowIso } from '../db/client.js';
import { bookmarks, syncState } from '../db/schema.js';
import { AppError } from '../lib/errors.js';

const MAX_TITLE_LENGTH = 2048;
const MAX_URL_LENGTH = 4096;
const MAX_REMOTE_ID_LENGTH = 128;
const MAX_CLIENT_ID_LENGTH = 128;

interface BookmarkRow {
  id: number;
  clientId: string;
  remoteId: string;
  parentId: string;
  type: string;
  title: string;
  url: string | null;
  position: number;
  faviconUrl: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > maxLength) return null;
  return value;
}

/** 校验单条 upsert 变更；返回 null 表示该条无效（跳过并计数） */
function validateUpsert(raw: unknown): SyncChange & { action: 'upsert' } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const change = raw as Record<string, unknown>;
  if (change['action'] !== 'upsert') return null;

  const remoteId = asString(change['remoteId'], MAX_REMOTE_ID_LENGTH);
  const parentId = asString(change['parentId'], MAX_REMOTE_ID_LENGTH) ?? '0';
  const title = typeof change['title'] === 'string' && change['title'].length <= MAX_TITLE_LENGTH ? change['title'] : '';
  const type = change['type'] === 'folder' ? 'folder' : change['type'] === 'bookmark' ? 'bookmark' : null;
  if (!remoteId || !type) return null;

  const positionRaw = change['position'];
  const position = typeof positionRaw === 'number' && Number.isInteger(positionRaw) && positionRaw >= 0 ? positionRaw : 0;

  let url: string | null = null;
  if (type === 'bookmark') {
    const rawUrl = change['url'];
    if (typeof rawUrl !== 'string' || rawUrl.length > MAX_URL_LENGTH || !isSafeUrl(rawUrl)) {
      // javascript:/data: 等 URL 一律拒绝
      return null;
    }
    url = rawUrl;
  }

  const dateAdded = typeof change['dateAdded'] === 'number' && Number.isFinite(change['dateAdded']) ? change['dateAdded'] : undefined;
  return { action: 'upsert', remoteId, parentId, type, title, url, position, dateAdded };
}

function rowDiffers(row: BookmarkRow, change: SyncChange & { action: 'upsert' }): boolean {
  return (
    row.parentId !== change.parentId ||
    row.type !== change.type ||
    row.title !== change.title ||
    row.url !== change.url ||
    row.position !== change.position
  );
}

/**
 * 核心同步引擎：Upsert + 软删除，绝不物理删除（除非用户在设置页手动清理）。
 *
 * - mode=incremental：只应用 changes 中的变更
 * - mode=full：应用 changes 后，将服务器上存在但本次未上报的节点软删除（定时全量校验，
 *   防止事件丢失导致漏同步删除）
 */
export function applySync(db: Db, payload: SyncRequest): SyncResponse {
  const clientId = payload.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0 || clientId.length > MAX_CLIENT_ID_LENGTH) {
    throw AppError.invalidPayload('clientId is required');
  }
  if (payload.mode !== 'incremental' && payload.mode !== 'full') {
    throw AppError.invalidPayload('mode must be "full" or "incremental"');
  }
  if (!Array.isArray(payload.changes)) {
    throw AppError.invalidPayload('changes must be an array');
  }
  if (payload.changes.length > 200_000) {
    throw AppError.invalidPayload('too many changes');
  }

  const mode: SyncMode = payload.mode;
  const now = nowIso();
  const stats: SyncStats = { created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0 };

  const upserts: Array<SyncChange & { action: 'upsert' }> = [];
  const deletes: string[] = [];

  for (const raw of payload.changes) {
    const item = raw as unknown as Record<string, unknown>;
    if (typeof raw === 'object' && raw !== null && item['action'] === 'delete') {
      const remoteId = asString(item['remoteId'], MAX_REMOTE_ID_LENGTH);
      if (remoteId) deletes.push(remoteId);
      else stats.skipped++;
      continue;
    }
    const upsert = validateUpsert(raw);
    if (upsert) upserts.push(upsert);
    else stats.skipped++;
  }

  // drizzle better-sqlite3 的 transaction 会立即执行并返回回调结果
  const serverVersion = db.transaction(() => {
    // 一次性载入该客户端的全部现有记录（含软删除），内存内对比
    const existingRows = db.select().from(bookmarks).where(eq(bookmarks.clientId, clientId)).all() as BookmarkRow[];
    const byRemoteId = new Map<string, BookmarkRow>();
    for (const row of existingRows) byRemoteId.set(row.remoteId, row);

    for (const change of upserts) {
      const row = byRemoteId.get(change.remoteId);
      const faviconUrl = change.type === 'bookmark' && change.url ? faviconForUrl(change.url) : null;

      if (!row) {
        const createdAt = change.dateAdded ? new Date(change.dateAdded).toISOString() : now;
        db.insert(bookmarks)
          .values({
            clientId,
            remoteId: change.remoteId,
            parentId: change.parentId,
            type: change.type,
            title: change.title,
            url: change.url,
            position: change.position,
            faviconUrl,
            createdAt,
            updatedAt: now,
          })
          .run();
        stats.created++;
        continue;
      }

      if (!row.deletedAt && !rowDiffers(row, change)) {
        stats.unchanged++;
        continue;
      }

      // 内容不同，或已被软删除后重新出现（例如用户撤销删除/重新创建同名节点）
      db.update(bookmarks)
        .set({
          parentId: change.parentId,
          type: change.type,
          title: change.title,
          url: change.url,
          position: change.position,
          faviconUrl,
          deletedAt: null,
          updatedAt: now,
        })
        .where(eq(bookmarks.id, row.id))
        .run();
      stats.updated++;
    }

    for (const remoteId of deletes) {
      const row = byRemoteId.get(remoteId);
      if (row && !row.deletedAt) {
        db.update(bookmarks).set({ deletedAt: now, updatedAt: now }).where(eq(bookmarks.id, row.id)).run();
        stats.deleted++;
      }
    }

    // 全量校验：服务器存在、Chrome 不存在 → 软删除
    if (mode === 'full') {
      const present = new Set(upserts.map((c) => c.remoteId));
      for (const row of existingRows) {
        if (!row.deletedAt && !present.has(row.remoteId)) {
          db.update(bookmarks).set({ deletedAt: now, updatedAt: now }).where(eq(bookmarks.id, row.id)).run();
          stats.deleted++;
        }
      }
    }

    // 更新客户端同步状态
    const state = db.select().from(syncState).where(eq(syncState.clientId, clientId)).get();
    if (state) {
      db.update(syncState)
        .set({
          lastSyncAt: now,
          lastFullSyncAt: mode === 'full' ? now : state.lastFullSyncAt,
          syncVersion: state.syncVersion + 1,
          updatedAt: now,
        })
        .where(eq(syncState.clientId, clientId))
        .run();
      return state.syncVersion + 1;
    }
    db.insert(syncState)
      .values({
        id: `state-${clientId}`,
        clientId,
        lastSyncAt: now,
        lastFullSyncAt: mode === 'full' ? now : null,
        syncVersion: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return 1;
  });

  return { success: true, ...stats, serverVersion };
}

/** 查找某客户端的同步状态 */
export function getSyncState(db: Db, clientId: string) {
  return db.select().from(syncState).where(eq(syncState.clientId, clientId)).get();
}

/** 统计存活节点数（type 传入时只统计对应类型） */
export function countNodes(db: Db, clientId?: string, type?: 'bookmark' | 'folder'): number {
  const conditions = [isNull(bookmarks.deletedAt)];
  if (clientId) conditions.push(eq(bookmarks.clientId, clientId));
  if (type) conditions.push(eq(bookmarks.type, type));
  return db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(and(...conditions))
    .all()
    .length;
}

/** 统计软删除节点数 */
export function countDeleted(db: Db): number {
  return db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(isNotNull(bookmarks.deletedAt))
    .all()
    .length;
}

