import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 网站用户（第一版仅单用户管理员） */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('users_username_uq').on(t.username)]);

/** 网站 Session（Cookie 中只存原始 token，服务器只存 hash） */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  lastUsedAt: text('last_used_at').notNull(),
}, (t) => [
  index('sessions_user_idx').on(t.userId),
  index('sessions_expires_idx').on(t.expiresAt),
]);

/** 扩展同步 Token（服务器只存 hash，明文只在创建时返回一次） */
export const syncTokens = sqliteTable('sync_tokens', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull(),
  /** 明文前缀，用于在列表中识别（例如 BM_AbCdEf） */
  prefix: text('prefix').notNull(),
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
}, (t) => [
  uniqueIndex('sync_tokens_hash_uq').on(t.tokenHash),
]);

/** 每个浏览器客户端的同步状态 */
export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  lastSyncAt: text('last_sync_at'),
  lastFullSyncAt: text('last_full_sync_at'),
  syncVersion: integer('sync_version').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => [uniqueIndex('sync_state_client_uq').on(t.clientId)]);

/**
 * 书签与文件夹统一存储。
 * remoteId 保存 Chrome 原始书签 ID；(client_id, remote_id) 唯一。
 * 不同浏览器的书签作为独立数据源保存，绝不跨设备合并。
 */
export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: text('client_id').notNull(),
  remoteId: text('remote_id').notNull(),
  parentId: text('parent_id').notNull().default('0'),
  /** 'bookmark' | 'folder' */
  type: text('type').notNull(),
  title: text('title').notNull().default(''),
  url: text('url'),
  position: integer('position').notNull().default(0),
  faviconUrl: text('favicon_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
}, (t) => [
  uniqueIndex('bookmarks_client_remote_uq').on(t.clientId, t.remoteId),
  index('bookmarks_client_live_idx').on(t.clientId, t.deletedAt),
  index('bookmarks_client_type_idx').on(t.clientId, t.type),
  index('bookmarks_url_idx').on(t.url),
]);

/** 简单的键值偏好设置（主题等） */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});
