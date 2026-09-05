import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Snapshot } from '@private-bookmarks/sync-protocol';

/**
 * chrome.storage 内存 mock：sync 与 local 两个独立区域，
 * 模拟浏览器账号同步存储与本机存储。
 */
type Area = Record<string, unknown>;

function makeStorageArea() {
  const data: Area = {};
  return {
    data,
    get: async (keys: string | string[] | null) => {
      const out: Area = {};
      const list = keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys];
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return out;
    },
    set: async (objs: Area) => {
      Object.assign(data, structuredClone(objs));
    },
    remove: async (keys: string | string[]) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
    },
  };
}

const storage = { sync: makeStorageArea(), local: makeStorageArea() };

beforeEach(() => {
  // 原地清空：mock 的 get/set/remove 闭包捕获的是 data 对象引用，不能整体替换
  for (const area of [storage.sync, storage.local]) {
    for (const k of Object.keys(area.data)) delete area.data[k];
  }
  (globalThis as { chrome?: unknown }).chrome = { storage };
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

describe('存储分层与账号同步', () => {
  it('全新安装：返回默认设置，同步区与本机区互不污染', async () => {
    const { getSettings, saveSettings } = await import('./storage.js');
    const settings = await getSettings();
    expect(settings).toEqual({
      serverUrl: '',
      syncToken: '',
      clientId: '',
      autoSyncPeriodMinutes: 360,
      eventSyncEnabled: true,
    });

    await saveSettings({ serverUrl: 'https://bm.example.com', syncToken: 'BM_x', clientId: 'chrome-desktop' });
    expect(Object.keys(storage.sync.data['settings'] as Area).sort()).toEqual([
      'autoSyncPeriodMinutes',
      'eventSyncEnabled',
      'serverUrl',
      'syncToken',
    ]);
    expect((storage.sync.data['settings'] as Area)['serverUrl']).toBe('https://bm.example.com');
    expect(storage.local.data['device']).toEqual({ clientId: 'chrome-desktop' });
  });

  it('saveSettings 把 clientId 路由到本机，其余路由到账号同步区', async () => {
    const { saveSettings, getSettings } = await import('./storage.js');
    await saveSettings({ eventSyncEnabled: false, autoSyncPeriodMinutes: 60 });
    await saveSettings({ clientId: 'edge-laptop' });

    const synced = storage.sync.data['settings'] as Area;
    expect(synced['autoSyncPeriodMinutes']).toBe(60);
    expect(synced['eventSyncEnabled']).toBe(false);
    expect(synced['serverUrl']).toBe(''); // 未设置的字段保持默认
    expect(storage.local.data['device']).toEqual({ clientId: 'edge-laptop' });

    const merged = await getSettings();
    expect(merged.clientId).toBe('edge-laptop');
    expect(merged.autoSyncPeriodMinutes).toBe(60);
  });

  it('旧版本迁移：local 旧设置拆分到 sync（偏好）+ local（clientId），旧键删除', async () => {
    storage.local.data['settings'] = {
      serverUrl: 'https://old.example.com',
      syncToken: 'BM_old',
      clientId: 'legacy-uuid',
      autoSyncPeriodMinutes: 720,
      eventSyncEnabled: false,
    };
    const { getSettings } = await import('./storage.js');
    const settings = await getSettings();

    expect(settings).toEqual({
      serverUrl: 'https://old.example.com',
      syncToken: 'BM_old',
      clientId: 'legacy-uuid',
      autoSyncPeriodMinutes: 720,
      eventSyncEnabled: false,
    });
    // 偏好进入账号同步区
    expect((storage.sync.data['settings'] as Area)['syncToken']).toBe('BM_old');
    // Client ID 留在本机
    expect(storage.local.data['device']).toEqual({ clientId: 'legacy-uuid' });
    // 旧键已清理
    expect(storage.local.data['settings']).toBeUndefined();

    // 再次读取直接走新布局，结果一致
    expect(await getSettings()).toEqual(settings);
  });

  it('账号同步场景：另一台机器写入 sync 区后，本机读取到新偏好但保留自己的 Client ID', async () => {
    const { getSettings } = await import('./storage.js');
    storage.sync.data['settings'] = {
      serverUrl: 'https://from-another-machine.example.com',
      syncToken: 'BM_synced',
      autoSyncPeriodMinutes: 1440,
      eventSyncEnabled: true,
    };
    storage.local.data['device'] = { clientId: 'this-machine' };

    const settings = await getSettings();
    expect(settings.serverUrl).toBe('https://from-another-machine.example.com');
    expect(settings.syncToken).toBe('BM_synced');
    expect(settings.clientId).toBe('this-machine');
  });

  it('快照与状态始终存本机（不跟随账号）', async () => {
    const { saveSnapshot, saveStatus, getStatus } = await import('./storage.js');
    const snapshot: Snapshot = { '1': { parentId: '0', type: 'folder', title: '书签栏', url: null, position: 0 } };
    await saveSnapshot(snapshot);
    await saveStatus({ lastSyncAt: '2026-08-30T00:00:00Z', lastSyncStatus: 'success' });

    expect(Object.keys(storage.local.data)).toEqual(expect.arrayContaining(['snapshot', 'status']));
    expect(storage.sync.data['snapshot']).toBeUndefined();
    expect(storage.sync.data['status']).toBeUndefined();
    expect((await getStatus()).lastSyncStatus).toBe('success');
  });

  it('ensureClientId：生成本机 ID 并持久化到 local；已有 ID 不变', async () => {
    const { ensureClientId } = await import('./storage.js');
    const first = await ensureClientId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect((storage.local.data['device'] as Area)['clientId']).toBe(first);

    const { saveSettings } = await import('./storage.js');
    await saveSettings({ clientId: 'custom-id' });
    const again = await ensureClientId();
    expect(again).toBe('custom-id');
  });
});
