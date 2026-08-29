import React from 'react';
import type { BookmarkNode } from '@private-bookmarks/shared';
import { Favicon, BookmarkLink } from './Favicon.js';

export interface TreeNode {
  node: BookmarkNode;
  children: TreeNode[];
  /** 客户端缺失父节点时挂在顶层（孤儿容错） */
  orphan: boolean;
}

/** 由平铺节点构建树；每层按 Chrome 根顺序与 position 排序 */
export function buildTree(nodes: BookmarkNode[]): TreeNode[] {
  const byRemoteId = new Map<string, TreeNode>();
  for (const node of nodes) byRemoteId.set(node.remoteId, { node, children: [], orphan: false });

  const roots: TreeNode[] = [];
  for (const node of nodes) {
    const item = byRemoteId.get(node.remoteId)!;
    const parent = node.parentId !== '0' ? byRemoteId.get(node.parentId) : undefined;
    if (parent && parent !== item) {
      parent.children.push(item);
    } else if (node.parentId !== '0') {
      item.orphan = true;
      roots.push(item);
    } else {
      roots.push(item);
    }
  }

  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => {
      const ra = rootOrder(a.node.remoteId);
      const rb = rootOrder(b.node.remoteId);
      if (ra !== null || rb !== null) return (ra ?? 99) - (rb ?? 99);
      if (a.node.position !== b.node.position) return a.node.position - b.node.position;
      return a.node.title.localeCompare(b.node.title, 'zh-CN');
    });
    for (const item of list) sortRec(item.children);
  };
  sortRec(roots);
  return roots;
}

function rootOrder(remoteId: string): number | null {
  if (remoteId === '1') return 0;
  if (remoteId === '2') return 1;
  if (remoteId === '3') return 2;
  return null;
}

export function countBookmarks(item: TreeNode): number {
  if (item.node.type === 'bookmark') return 1;
  return item.children.reduce((sum, child) => sum + countBookmarks(child), 0);
}

function TreeItem({ item, depth }: { item: TreeNode; depth: number }) {
  const isFolder = item.node.type === 'folder';
  const [open, setOpen] = React.useState(depth < 1);

  if (!isFolder) {
    return (
      <div className="bookmark-row" style={{ paddingLeft: `${depth * 18 + 8}px` }}>
        <Favicon node={item.node} />
        <BookmarkLink node={item.node} />
        <span className="bookmark-url">{item.node.url}</span>
      </div>
    );
  }

  return (
    <div className="folder-block">
      <button
        className="folder-row"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="folder-arrow" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
        <span className="bookmark-icon" aria-hidden>
          {open ? '📂' : '📁'}
        </span>
        <span className="folder-title">{item.node.title || '未命名文件夹'}</span>
        <span className="folder-count">{countBookmarks(item)}</span>
      </button>
      {open && (
        <div className="folder-children">
          {item.children.map((child) => (
            <TreeItem key={child.node.remoteId} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BookmarkTree({ items }: { items: TreeNode[] }) {
  if (items.length === 0) {
    return <div className="empty-hint">还没有书签，先在浏览器安装扩展同步，或在设置页导入。</div>;
  }
  return (
    <div className="tree">
      {items.map((item) => (
        <TreeItem key={item.node.remoteId} item={item} depth={0} />
      ))}
    </div>
  );
}
