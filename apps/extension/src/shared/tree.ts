import type { Snapshot, SnapshotNode, SyncChange } from '@private-bookmarks/sync-protocol';

/** chrome.bookmarks.getTree() 返回的节点 */
export type BrowserBookmarkNode = {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  /** 节点在父文件夹中的序号，Chrome 直接提供 */
  index?: number;
  dateAdded?: number;
  children?: BrowserBookmarkNode[];
};

/**
 * 把浏览器书签树扁平化为 Snapshot（id → 节点信息）。
 * 根节点 id "0" 本身不写入，其子节点 parentId 记为 "0"。
 */
export function flattenTree(nodes: BrowserBookmarkNode[]): Snapshot {
  const result: Snapshot = {};
  const walk = (list: BrowserBookmarkNode[], parent: string): void => {
    for (const node of list) {
      if (node.id === '0') {
        // 浏览器虚拟根节点不入库
        if (node.children) walk(node.children, '0');
        continue;
      }
      const item: SnapshotNode = {
        parentId: parent,
        type: node.url ? 'bookmark' : 'folder',
        title: node.title,
        url: node.url ?? null,
        position: typeof node.index === 'number' ? node.index : 0,
      };
      result[node.id] = item;
      if (node.children) walk(node.children, node.id);
    }
  };
  walk(nodes, '0');
  return result;
}

function nodeEquals(a: SnapshotNode, b: SnapshotNode): boolean {
  return (
    a.parentId === b.parentId &&
    a.type === b.type &&
    a.title === b.title &&
    a.url === b.url &&
    a.position === b.position
  );
}

/**
 * 本地 diff：对比上次快照与当前树，产出最小变更集。
 * 目录被删除时 Chrome 不会逐个通知子节点，快照 diff 能自动覆盖其全部后代。
 */
export function diffSnapshot(previous: Snapshot, current: Snapshot): SyncChange[] {
  const changes: SyncChange[] = [];

  for (const [id, node] of Object.entries(current)) {
    const prev = previous[id];
    if (prev && nodeEquals(prev, node)) continue;
    changes.push({
      action: 'upsert',
      remoteId: id,
      parentId: node.parentId,
      type: node.type,
      title: node.title,
      url: node.url,
      position: node.position,
    });
  }

  for (const id of Object.keys(previous)) {
    if (!(id in current)) {
      changes.push({ action: 'delete', remoteId: id });
    }
  }

  return changes;
}

/** 全量同步 payload：所有节点都作为 upsert 上报，服务器据此做全量校验 */
export function fullSyncChanges(current: Snapshot, dateAddedById: Map<string, number> = new Map()): SyncChange[] {
  return Object.entries(current).map(([id, node]) => ({
    action: 'upsert' as const,
    remoteId: id,
    parentId: node.parentId,
    type: node.type,
    title: node.title,
    url: node.url,
    position: node.position,
    dateAdded: dateAddedById.get(id),
  }));
}

/** 统计书签树中 bookmark 数量（popup 显示用） */
export function countBookmarks(nodes: BrowserBookmarkNode[]): number {
  let count = 0;
  const walk = (list: BrowserBookmarkNode[]): void => {
    for (const node of list) {
      if (node.url) count++;
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return count;
}

/** 从完整树提取 dateAdded 映射（新建节点记录原始添加时间） */
export function collectDateAdded(nodes: BrowserBookmarkNode[]): Map<string, number> {
  const map = new Map<string, number>();
  const walk = (list: BrowserBookmarkNode[]): void => {
    for (const node of list) {
      if (node.id !== '0' && typeof node.dateAdded === 'number') map.set(node.id, node.dateAdded);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return map;
}
