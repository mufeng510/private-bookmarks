/**
 * 浏览器扩展 ↔ 服务器 同步协议。
 *
 * 核心原则：单向同步，数据只允许 Browser → Server。
 * 服务器绝不向浏览器下发任何书签修改指令。
 */
import type { BookmarkType } from '@private-bookmarks/shared';

export type SyncMode = 'full' | 'incremental';

export type SyncAction = 'upsert' | 'delete';

/** 单条变更：书签/文件夹的新增、修改、移动（合并为 upsert）与删除 */
export interface SyncChangeUpsert {
  remoteId: string;
  action: 'upsert';
  type: BookmarkType;
  /** 顶层节点 parentId 为 "0" */
  parentId: string;
  title: string;
  /** 仅 bookmark 有 URL；服务器只接受 http/https */
  url: string | null;
  position: number;
  /** Chrome 书签的 dateAdded（毫秒时间戳），可选 */
  dateAdded?: number;
}

export interface SyncChangeDelete {
  remoteId: string;
  action: 'delete';
}

export type SyncChange = SyncChangeUpsert | SyncChangeDelete;

/** POST /api/sync 请求体 */
export interface SyncRequest {
  clientId: string;
  mode: SyncMode;
  changes: SyncChange[];
}

/** 同步统计 */
export interface SyncStats {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  /** 因非法 URL 等原因被跳过的条目数 */
  skipped: number;
}

/** POST /api/sync 响应体 */
export interface SyncResponse extends SyncStats {
  success: boolean;
  serverVersion: number;
}

/** GET /api/sync/ping 响应（扩展配置页"测试连接"用） */
export interface SyncPingResponse {
  ok: true;
  clientId: string;
}

/** GET /api/sync/status 响应（网站设置页用，Session 认证） */
export interface SyncStatusResponse {
  clients: Array<{
    clientId: string;
    lastSyncAt: string | null;
    lastFullSyncAt: string | null;
    syncVersion: number;
    bookmarkCount: number;
  }>;
  totalBookmarks: number;
  totalDeleted: number;
}

/**
 * 扩展本地快照节点（chrome.storage.local 中保存的书签树扁平快照，
 * 用于本地 diff 计算增量变更，绝不包含服务器数据）。
 */
export interface SnapshotNode {
  parentId: string;
  type: BookmarkType;
  title: string;
  url: string | null;
  position: number;
}

export type Snapshot = Record<string, SnapshotNode>;
