import { and, eq, isNull } from 'drizzle-orm';
import type { BookmarkNode, BookmarkType } from '@private-bookmarks/shared';
import type { Db } from '../db/client.js';
import { bookmarks } from '../db/schema.js';

export interface BookmarkRecord {
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

export function toNode(row: BookmarkRecord): BookmarkNode {
  return {
    id: row.id,
    clientId: row.clientId,
    remoteId: row.remoteId,
    parentId: row.parentId,
    type: row.type as BookmarkType,
    title: row.title,
    url: row.url,
    position: row.position,
    faviconUrl: row.faviconUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listLiveNodes(db: Db, clientId?: string): BookmarkRecord[] {
  const conditions = [isNull(bookmarks.deletedAt)];
  if (clientId) conditions.push(eq(bookmarks.clientId, clientId));
  return db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .all() as BookmarkRecord[];
}

export function sortNodes(nodes: BookmarkRecord[]): BookmarkRecord[] {
  // Chrome 顶层根节点顺序：书签栏(1) → 其他书签(2) → 移动设备书签；同级按 position
  return [...nodes].sort((a, b) => {
    const rootA = rootOrder(a.remoteId);
    const rootB = rootOrder(b.remoteId);
    if (rootA !== null || rootB !== null) {
      return (rootA ?? Number.MAX_SAFE_INTEGER) - (rootB ?? Number.MAX_SAFE_INTEGER);
    }
    if (a.parentId !== b.parentId) return a.parentId.localeCompare(b.parentId, undefined, { numeric: true });
    return a.position - b.position;
  });
}

function rootOrder(remoteId: string): number | null {
  if (remoteId === '1') return 0;
  if (remoteId === '2') return 1;
  if (remoteId === '3') return 2;
  return null;
}

export interface TreeNode extends BookmarkNode {
  children: TreeNode[];
}

/**
 * 由平铺节点构建树。
 * parentId 为 "0" 或父节点缺失的节点作为顶层（容错处理孤儿节点）。
 */
export function buildTree(nodes: BookmarkRecord[]): TreeNode[] {
  const sorted = sortNodes(nodes);
  const byRemoteId = new Map<string, TreeNode>();
  for (const row of sorted) byRemoteId.set(row.remoteId, { ...toNode(row), children: [] });

  const roots: TreeNode[] = [];
  for (const row of sorted) {
    const node = byRemoteId.get(row.remoteId)!;
    const parent = row.parentId !== '0' ? byRemoteId.get(row.parentId) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/** 计算节点的文件夹路径（从顶层到直接父文件夹） */
export function folderPaths(nodes: BookmarkRecord[]): Map<string, string[]> {
  const titleByRemoteId = new Map<string, string>();
  const parentByRemoteId = new Map<string, string>();
  for (const row of nodes) {
    titleByRemoteId.set(row.remoteId, row.title);
    parentByRemoteId.set(row.remoteId, row.parentId);
  }

  const cache = new Map<string, string[]>();
  const pathOf = (remoteId: string): string[] => {
    const cached = cache.get(remoteId);
    if (cached) return cached;
    const parentId = parentByRemoteId.get(remoteId);
    let path: string[] = [];
    if (parentId && parentId !== '0') {
      path = pathOf(parentId);
      const title = titleByRemoteId.get(parentId);
      if (title) path = [...path, title];
    }
    cache.set(remoteId, path);
    return path;
  };

  const result = new Map<string, string[]>();
  for (const row of nodes) result.set(row.remoteId, pathOf(row.remoteId));
  return result;
}

/** 服务器端搜索：标题 + URL + 文件夹路径，最大返回 200 条 */
export function searchNodes(nodes: BookmarkRecord[], query: string): Array<BookmarkRecord & { folderPath: string[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const paths = folderPaths(nodes);
  const results: Array<BookmarkRecord & { folderPath: string[] }> = [];

  for (const row of sortNodes(nodes)) {
    if (results.length >= 200) break;
    const folderPath = paths.get(row.remoteId) ?? [];
    const haystack =
      row.type === 'bookmark'
        ? `${row.title}\n${row.url ?? ''}\n${folderPath.join('/')}`
        : `${row.title}\n${folderPath.join('/')}`;
    if (haystack.toLowerCase().includes(q)) {
      results.push({ ...row, folderPath });
    }
  }
  return results;
}
