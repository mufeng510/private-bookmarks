import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, createSyncTokenViaApi, login, upsert, type TestApp } from './test/helpers.js';
import type { SyncResponse } from '@private-bookmarks/sync-protocol';

describe('设备管理（自定义 Client ID 场景）', () => {
  let app: TestApp;
  let cookies: Record<string, string>;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    cookies = (await login(app.app)).cookies;
    token = await createSyncTokenViaApi(app.app, cookies);
  });

  afterAll(async () => {
    await app.close();
  });

  function sync(clientId: string) {
    return app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientId,
        mode: 'full',
        changes: [
          upsert({ remoteId: '1', type: 'folder', title: '书签栏', position: 0 }),
          upsert({ remoteId: '11', parentId: '1', type: 'bookmark', title: 'GitHub', url: 'https://github.com', position: 0 }),
        ],
      },
    });
  }

  it('扩展同步禁止使用保留标识 "import"（防止污染导入命名空间）', async () => {
    const res = await sync('import');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_PAYLOAD');
    expect(res.json().error.message).toContain('reserved');
  });

  it('删除设备数据需要登录', async () => {
    const res = await app.app.inject({ method: 'DELETE', url: '/api/clients/some-device' });
    expect(res.statusCode).toBe(401);
  });

  it('重装系统场景：新 Client ID 同步新数据，旧设备数据可整体删除', async () => {
    // 旧设备同步
    expect((await sync('old-uuid-aaaa')).json<SyncResponse>().created).toBe(2);

    // 重装后换成自定义标识，同一浏览器重新全量同步
    expect((await sync('chrome-desktop')).json<SyncResponse>().created).toBe(2);

    // 两个命名空间并存（互不影响）
    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks', cookies });
    const byClient = list.json<{ clients: Array<{ clientId: string; bookmarkCount: number }> }>().clients;
    expect(byClient.find((c) => c.clientId === 'old-uuid-aaaa')?.bookmarkCount).toBe(1);
    expect(byClient.find((c) => c.clientId === 'chrome-desktop')?.bookmarkCount).toBe(1);

    // 删除旧设备数据
    const del = await app.app.inject({ method: 'DELETE', url: '/api/clients/old-uuid-aaaa', cookies });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toMatchObject({ ok: true, bookmarks: 2 });

    // 旧设备数据与状态完全消失，新设备不受影响
    const after = await app.app.inject({ method: 'GET', url: '/api/bookmarks', cookies });
    const clients = after.json<{ clients: Array<{ clientId: string }> }>().clients;
    expect(clients.some((c) => c.clientId === 'old-uuid-aaaa')).toBe(false);
    expect(clients.some((c) => c.clientId === 'chrome-desktop')).toBe(true);
    const search = await app.app.inject({ method: 'GET', url: '/api/bookmarks/search?q=github&client=old-uuid-aaaa', cookies });
    expect(search.json<{ results: unknown[] }>().results).toHaveLength(0);
  });

  it('删除后同一 Client ID 可重新全量同步（复活场景）', async () => {
    const del = await app.app.inject({ method: 'DELETE', url: '/api/clients/chrome-desktop', cookies });
    expect(del.statusCode).toBe(200);

    const resync = await sync('chrome-desktop');
    expect(resync.statusCode).toBe(200);
    expect(resync.json<SyncResponse>().created).toBe(2);

    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks?client=chrome-desktop', cookies });
    expect(list.json<{ nodes: unknown[] }>().nodes).toHaveLength(2);
  });

  it('删除不存在的设备返回 404；非法 clientId 返回 400', async () => {
    const missing = await app.app.inject({ method: 'DELETE', url: '/api/clients/no-such-device', cookies });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');

    const bad = await app.app.inject({ method: 'DELETE', url: '/api/clients/%2E%2E%2Fetc', cookies });
    expect(bad.statusCode).toBe(400);
  });
});
