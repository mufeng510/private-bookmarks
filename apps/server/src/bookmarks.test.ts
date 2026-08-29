import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, createSyncTokenViaApi, login, upsert, type TestApp } from './test/helpers.js';

describe('书签查询与搜索', () => {
  let app: TestApp;
  let cookies: Record<string, string>;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    cookies = (await login(app.app)).cookies;
    token = await createSyncTokenViaApi(app.app, cookies);
    await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientId: 'chrome-desktop-001',
        mode: 'full',
        changes: [
          upsert({ remoteId: '1', type: 'folder', title: '书签栏', position: 0 }),
          upsert({ remoteId: '10', parentId: '1', type: 'folder', title: 'AI 工具', position: 0 }),
          upsert({ remoteId: '11', parentId: '10', type: 'bookmark', title: 'GitHub', url: 'https://github.com', position: 0 }),
          upsert({ remoteId: '12', parentId: '10', type: 'bookmark', title: '文档站', url: 'https://docs.github.com', position: 1 }),
          upsert({ remoteId: '20', parentId: '1', type: 'bookmark', title: 'Zed 编辑器', url: 'https://zed.dev', position: 1 }),
        ],
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('搜索标题命中多条', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/bookmarks/search?q=github', cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ query: string; results: Array<{ title: string; folderPath: string[] }> }>();
    const titles = body.results.map((r) => r.title);
    expect(titles).toContain('GitHub');
    expect(titles).toContain('文档站'); // URL 中包含 github
  });

  it('搜索命中文件夹名称（书签挂在匹配文件夹下）', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/bookmarks/search?q=AI', cookies });
    const body = res.json<{ results: Array<{ title: string }> }>();
    const titles = body.results.map((r) => r.title);
    expect(titles).toContain('AI 工具'); // 文件夹本身
    expect(titles).toContain('GitHub'); // 文件夹路径匹配
  });

  it('中文搜索正常工作', async () => {
    const res = await app.app.inject({ method: 'GET', url: `/api/bookmarks/search?q=${encodeURIComponent('编辑器')}`, cookies });
    const body = res.json<{ results: Array<{ title: string }> }>();
    expect(body.results.map((r) => r.title)).toContain('Zed 编辑器');
  });

  it('搜索 API 未登录返回 401', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/bookmarks/search?q=github' });
    expect(res.statusCode).toBe(401);
  });

  it('按 ID 查询单个书签，不存在返回 404', async () => {
    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks', cookies });
    const node = list.json<{ nodes: Array<{ id: number; remoteId: string }> }>().nodes.find((n) => n.remoteId === '11');
    expect(node).toBeDefined();

    const one = await app.app.inject({ method: 'GET', url: `/api/bookmarks/${node!.id}`, cookies });
    expect(one.statusCode).toBe(200);
    expect(one.json().url).toBe('https://github.com');

    const missing = await app.app.inject({ method: 'GET', url: '/api/bookmarks/999999', cookies });
    expect(missing.statusCode).toBe(404);
    const bad = await app.app.inject({ method: 'GET', url: '/api/bookmarks/abc', cookies });
    expect(bad.statusCode).toBe(404);
  });

  it('清理已删除书签（purge）', async () => {
    // 先软删除一个
    await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientId: 'chrome-desktop-001', mode: 'incremental', changes: [{ action: 'delete', remoteId: '20' }] },
    });

    const status = await app.app.inject({ method: 'GET', url: '/api/sync/status', cookies });
    const deletedBefore = status.json<{ totalDeleted: number }>().totalDeleted;
    expect(deletedBefore).toBeGreaterThan(0);

    const purge = await app.app.inject({ method: 'POST', url: '/api/bookmarks/purge-deleted', cookies });
    expect(purge.statusCode).toBe(200);
    expect(purge.json().purged).toBe(deletedBefore);

    const status2 = await app.app.inject({ method: 'GET', url: '/api/sync/status', cookies });
    expect(status2.json<{ totalDeleted: number }>().totalDeleted).toBe(0);
  });
});
