/** 书签节点类型：书签或文件夹 */
export type BookmarkType = 'bookmark' | 'folder';

/** 单个书签/文件夹节点（Web 与服务器之间的传输结构） */
export interface BookmarkNode {
  /** 数据库内部 ID */
  id: number;
  /** 来源客户端 ID（浏览器设备） */
  clientId: string;
  /** Chrome 原始书签 ID */
  remoteId: string;
  /** 父节点 Chrome ID，顶层节点为 "0" */
  parentId: string;
  type: BookmarkType;
  title: string;
  /** 仅 type=bookmark 时存在，协议白名单校验后的 URL */
  url: string | null;
  position: number;
  faviconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 客户端（浏览器设备）概要信息 */
export interface ClientInfo {
  clientId: string;
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  syncVersion: number;
  bookmarkCount: number;
}

/** GET /api/bookmarks 响应 */
export interface BookmarksResponse {
  clients: ClientInfo[];
  /** 当前返回树对应的客户端，"all" 表示全部 */
  client: string;
  nodes: BookmarkNode[];
}

/** 搜索结果条目（带文件夹路径的平铺列表） */
export interface SearchResultItem {
  id: number;
  clientId: string;
  remoteId: string;
  type: BookmarkType;
  title: string;
  url: string | null;
  faviconUrl: string | null;
  /** 文件夹路径，例如 ["书签栏", "AI"] */
  folderPath: string[];
}

/** GET /api/bookmarks/search?q= 响应 */
export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

/** 统一错误响应体 */
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'INVALID_SYNC_TOKEN'
  | 'TOKEN_REVOKED'
  | 'RATE_LIMITED'
  | 'INVALID_URL'
  | 'INVALID_PAYLOAD'
  | 'FORBIDDEN_ORIGIN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR';

/** 全局应用版本号（与各 package.json / manifest.json 保持一致，CI 校验） */
export const APP_VERSION = '1.0.0';

/** Sync Token 前缀 */
export const SYNC_TOKEN_PREFIX = 'BM_';

/** Session Cookie 名称 */
export const SESSION_COOKIE_NAME = 'pb_session';

/** 服务器接受的 URL 协议白名单 */
export const ALLOWED_URL_PROTOCOLS = ['http:', 'https:'] as const;

/** 默认 favicon 服务（服务器端生成，浏览器端加载失败时显示默认图标） */
export function faviconForUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
  } catch {
    return null;
  }
}

/** 校验 URL 是否只使用 http/https 协议，防止 javascript:/data: 等注入 */
export function isSafeUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (ALLOWED_URL_PROTOCOLS as readonly string[]).includes(parsed.protocol);
  } catch {
    return false;
  }
}
