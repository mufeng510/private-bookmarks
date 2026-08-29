import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, createSyncTokenViaApi, login, type TestApp } from './test/helpers.js';
import type { SyncChange } from '@private-bookmarks/sync-protocol';

/**
 * 大量书签场景：目标规模 10000 bookmarks 依然可用。
 * 测试中使用 5000 节点验证同步与搜索性能在可接受范围。
 */
describe('大量书签', () => {
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

  const FOLDERS = 50;
  const PER_FOLDER = 100; // 50 * 100 = 5000 bookmarks

  function buildChanges(mode: 'create' | 'modify'): SyncChange[] {
    const changes: SyncChange[] = [
      { action: 'upsert', remoteId: 'root', parentId: '0', type: 'folder', title: '书签栏', url: null, position: 0 },
    ];
    for (let f = 0; f < FOLDERS; f++) {
      changes.push({
        action: 'upsert',
        remoteId: `f${f}`,
        parentId: 'root',
        type: 'folder',
        title: `分类 ${f}`,
        url: null,
        position: f,
      });
      for (let i = 0; i < PER_FOLDER; i++) {
        changes.push({
          action: 'upsert',
          remoteId: `f${f}-b${i}`,
          parentId: `f${f}`,
          type: 'bookmark',
          title: mode === 'modify' ? `书签 ${f}-${i} 更新` : `书签 ${f}-${i}`,
          url: `https://example.com/${f}/${i}`,
          position: i,
        });
      }
    }
    return changes;
  }

  it('初次全量同步 5000+ 节点', async () => {
    const start = Date.now();
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientId: 'bulk', mode: 'full', changes: buildChanges('create') },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ created: number; unchanged: number }>();
    expect(body.created).toBe(FOLDERS * PER_FOLDER + FOLDERS + 1);
    const elapsed = Date.now() - start;
    console.log(`full sync of ${body.created} nodes took ${elapsed}ms`);
    expect(elapsed).toBeLessThan(30_000);
  });

  it('再次全量同步全部 unchanged', async () => {
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientId: 'bulk', mode: 'full', changes: buildChanges('create') },
    });
    expect(res.json<{ unchanged: number }>().unchanged).toBe(FOLDERS * PER_FOLDER + FOLDERS + 1);
  });

  it('服务端搜索在 5000+ 节点下快速返回', async () => {
    const start = Date.now();
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/bookmarks/search?q=书签 7-3',
      cookies,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ results: Array<{ title: string }> }>();
    expect(body.results.length).toBeGreaterThan(0);
    const elapsed = Date.now() - start;
    console.log(`search over 5000+ nodes took ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5_000);
  });

  it('批量修改标题（5000 upserts）', async () => {
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientId: 'bulk', mode: 'incremental', changes: buildChanges('modify') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ updated: number }>().updated).toBe(FOLDERS * PER_FOLDER);
  });
});
