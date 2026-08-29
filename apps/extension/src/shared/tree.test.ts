import { describe, it, expect } from 'vitest';
import { diffSnapshot, flattenTree, fullSyncChanges, countBookmarks } from './tree.js';
import type { BrowserBookmarkNode } from './tree.js';
import type { Snapshot } from '@private-bookmarks/sync-protocol';

const TREE: BrowserBookmarkNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: '书签栏',
        children: [
          {
            id: '10',
            title: 'AI',
            children: [
              { id: '11', title: 'ChatGPT', url: 'https://chat.openai.com', index: 0, dateAdded: 1690000000000 },
              { id: '12', title: 'Claude', url: 'https://claude.ai', index: 1 },
            ],
          },
          { id: '20', title: 'GitHub', url: 'https://github.com', index: 1 },
        ],
      },
      { id: '2', title: '其他书签', children: [] },
    ],
  },
];

describe('flattenTree', () => {
  it('扁平化并保留层级、位置、类型', () => {
    const snap = flattenTree(TREE);
    expect(Object.keys(snap).sort()).toEqual(['1', '10', '11', '12', '2', '20']);
    expect(snap['0']).toBeUndefined(); // 虚拟根不入库
    expect(snap['1']).toMatchObject({ parentId: '0', type: 'folder', title: '书签栏', position: 0 });
    expect(snap['10']).toMatchObject({ parentId: '1', type: 'folder', title: 'AI' });
    expect(snap['11']).toMatchObject({ parentId: '10', type: 'bookmark', url: 'https://chat.openai.com', position: 0 });
    expect(snap['20']).toMatchObject({ parentId: '1', type: 'bookmark', position: 1 });
  });

  it('统计书签数量', () => {
    expect(countBookmarks(TREE)).toBe(3);
  });
});

describe('diffSnapshot', () => {
  it('首次 diff 产生全部 upsert', () => {
    const current = flattenTree(TREE);
    const changes = diffSnapshot({} as Snapshot, current);
    expect(changes).toHaveLength(6);
    expect(changes.every((c) => c.action === 'upsert')).toBe(true);
  });

  it('无变化时 diff 为空（幂等）', () => {
    const current = flattenTree(TREE);
    expect(diffSnapshot(current, current)).toHaveLength(0);
  });

  it('检测修改标题、移动、新增、删除', () => {
    const current = flattenTree(TREE);
    const modified: Snapshot = JSON.parse(JSON.stringify(current));
    modified['11']!.title = 'ChatGPT 新'; // 改标题
    modified['20']!.parentId = '10'; // 移动到 AI 文件夹
    modified['20']!.position = 2;
    modified['99'] = { parentId: '1', type: 'bookmark', title: '新站点', url: 'https://new.example.com', position: 3 };
    delete modified['2']; // 删除"其他书签"文件夹

    const changes = diffSnapshot(current, modified);
    const upserts = Object.fromEntries(changes.filter((c) => c.action === 'upsert').map((c) => [c.remoteId, c]));
    const deletes = changes.filter((c) => c.action === 'delete');

    expect(upserts['11']?.title).toBe('ChatGPT 新');
    expect(upserts['20']?.parentId).toBe('10');
    expect(upserts['99']?.url).toBe('https://new.example.com');
    expect(deletes.map((d) => d.remoteId)).toEqual(['2']);
  });

  it('删除文件夹时其所有后代都进入删除列表（快照 diff 覆盖 Chrome 递归删除）', () => {
    const current = flattenTree(TREE);
    const modified: Snapshot = JSON.parse(JSON.stringify(current));
    delete modified['10']; // 删除 AI 文件夹本身
    delete modified['11'];
    delete modified['12'];
    // Chrome 事件只通知文件夹被删；diff 通过快照自动覆盖 11/12

    const changes = diffSnapshot(current, modified);
    const deletes = changes.filter((c) => c.action === 'delete').map((c) => c.remoteId).sort();
    expect(deletes).toEqual(['10', '11', '12']);
  });
});

describe('fullSyncChanges', () => {
  it('全量 payload 包含所有节点并携带 dateAdded', () => {
    const current = flattenTree(TREE);
    const dates = collectDates(TREE);
    const changes = fullSyncChanges(current, dates);
    expect(changes).toHaveLength(6);
    const chatgpt = changes.find((c) => c.remoteId === '11');
    expect(chatgpt).toMatchObject({ action: 'upsert', dateAdded: 1690000000000 });
  });

  function collectDates(nodes: BrowserBookmarkNode[]): Map<string, number> {
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
});
