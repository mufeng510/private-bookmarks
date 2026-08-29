import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, createSyncTokenViaApi, login, upsert, del, type TestApp } from './test/helpers.js';
import type { SyncResponse } from '@private-bookmarks/sync-protocol';

describe('同步', () => {
  let app: TestApp;
  let cookies: Record<string, string>;
  let token: string;

  beforeAll(async () => {
    app = await buildTestApp();
    cookies = (await login(app.app)).cookies;
    token = await createSyncTokenViaApi(app.app, cookies, 'chrome-desktop');
  });

  afterAll(async () => {
    await app.close();
  });

  function sync(payload: object, withToken = token) {
    return app.app.inject({
      method: 'POST',
      url: '/api/sync',
      headers: withToken ? { authorization: `Bearer ${withToken}` } : {},
      payload,
    });
  }

  it('Sync API 拒绝无 Token / 错误 Token / 网站 Session', async () => {
    const noAuth = await sync({ clientId: 'x', mode: 'incremental', changes: [] }, '');
    expect(noAuth.statusCode).toBe(401);
    expect(noAuth.json().error.code).toBe('INVALID_SYNC_TOKEN');

    const badToken = await sync({ clientId: 'x', mode: 'incremental', changes: [] }, 'BM_wrong_token');
    expect(badToken.statusCode).toBe(401);
    expect(badToken.json().error.code).toBe('INVALID_SYNC_TOKEN');

    // 网站 Session 不能替代 Sync Token
    const sessionOnly = await app.app.inject({
      method: 'POST',
      url: '/api/sync',
      cookies,
      payload: { clientId: 'x', mode: 'incremental', changes: [] },
    });
    expect(sessionOnly.statusCode).toBe(401);
    expect(sessionOnly.json().error.code).toBe('INVALID_SYNC_TOKEN');
  });

  it('ping 验证 Token 连通性', async () => {
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/sync/ping',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('初次全量同步：全部 created，文件夹层级正确', async () => {
    const res = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'full',
      changes: [
        upsert({ remoteId: '1', type: 'folder', title: '书签栏', position: 0 }),
        upsert({ remoteId: '10', parentId: '1', type: 'folder', title: 'AI', position: 0 }),
        upsert({ remoteId: '11', parentId: '10', type: 'bookmark', title: 'ChatGPT', url: 'https://chat.openai.com', position: 0 }),
        upsert({ remoteId: '12', parentId: '10', type: 'bookmark', title: 'Claude', url: 'https://claude.ai', position: 1 }),
        upsert({ remoteId: '2', type: 'folder', title: '其他书签', position: 1 }),
        upsert({ remoteId: '20', parentId: '2', type: 'bookmark', title: 'GitHub', url: 'https://github.com', position: 0 }),
      ],
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<SyncResponse>();
    expect(body.success).toBe(true);
    expect(body.created).toBe(6);
    expect(body.updated).toBe(0);
    expect(body.deleted).toBe(0);
    expect(body.unchanged).toBe(0);

    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks', cookies });
    expect(list.statusCode).toBe(200);
    const data = list.json<{ nodes: Array<{ remoteId: string; parentId: string; title: string; type: string; faviconUrl: string | null }> }>();
    expect(data.nodes).toHaveLength(6);
    const ai = data.nodes.find((n) => n.remoteId === '10');
    expect(ai?.parentId).toBe('1');
    const chatgpt = data.nodes.find((n) => n.remoteId === '11');
    expect(chatgpt?.faviconUrl).toContain('openai.com');
  });

  it('重复全量同步：全部 unchanged（幂等）', async () => {
    const res = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'full',
      changes: [
        upsert({ remoteId: '1', type: 'folder', title: '书签栏', position: 0 }),
        upsert({ remoteId: '10', parentId: '1', type: 'folder', title: 'AI', position: 0 }),
        upsert({ remoteId: '11', parentId: '10', type: 'bookmark', title: 'ChatGPT', url: 'https://chat.openai.com', position: 0 }),
        upsert({ remoteId: '12', parentId: '10', type: 'bookmark', title: 'Claude', url: 'https://claude.ai', position: 1 }),
        upsert({ remoteId: '2', type: 'folder', title: '其他书签', position: 1 }),
        upsert({ remoteId: '20', parentId: '2', type: 'bookmark', title: 'GitHub', url: 'https://github.com', position: 0 }),
      ],
    });
    const body = res.json<SyncResponse>();
    expect(body.created).toBe(0);
    expect(body.updated).toBe(0);
    expect(body.unchanged).toBe(6);
  });

  it('增量同步：新增/修改标题/移动/删除', async () => {
    // 新增
    const add = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'incremental',
      changes: [upsert({ remoteId: '30', parentId: '2', type: 'bookmark', title: 'Docker', url: 'https://docker.com', position: 1 })],
    });
    expect(add.json<SyncResponse>().created).toBe(1);

    // 修改标题 + 移动
    const move = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'incremental',
      changes: [upsert({ remoteId: '30', parentId: '10', type: 'bookmark', title: 'Docker Docs', url: 'https://docker.com', position: 2 })],
    });
    expect(move.json<SyncResponse>().updated).toBe(1);

    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks?client=chrome-desktop-001', cookies });
    const node = list.json<{ nodes: Array<{ remoteId: string; title: string; parentId: string }> }>().nodes.find((n) => n.remoteId === '30');
    expect(node?.title).toBe('Docker Docs');
    expect(node?.parentId).toBe('10');

    // 删除 → 软删除，列表中消失
    const rm = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'incremental',
      changes: [del('30')],
    });
    expect(rm.json<SyncResponse>().deleted).toBe(1);
    const after = await app.app.inject({ method: 'GET', url: '/api/bookmarks', cookies });
    expect(after.json<{ nodes: Array<{ remoteId: string }> }>().nodes.some((n) => n.remoteId === '30')).toBe(false);
  });

  it('全量校验：服务器存在但 Chrome 不存在的节点被软删除', async () => {
    const res = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'full',
      changes: [
        upsert({ remoteId: '1', type: 'folder', title: '书签栏', position: 0 }),
        upsert({ remoteId: '10', parentId: '1', type: 'folder', title: 'AI', position: 0 }),
        upsert({ remoteId: '11', parentId: '10', type: 'bookmark', title: 'ChatGPT', url: 'https://chat.openai.com', position: 0 }),
        upsert({ remoteId: '12', parentId: '10', type: 'bookmark', title: 'Claude', url: 'https://claude.ai', position: 1 }),
      ],
    });
    // '2'、'20' 未上报 → 应被软删除
    const body = res.json<SyncResponse>();
    expect(body.deleted).toBe(2); // 节点2 + 节点20
    expect(body.unchanged).toBe(4);

    // 重新出现（撤销删除）→ 更新恢复
    const back = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'incremental',
      changes: [upsert({ remoteId: '20', parentId: '2', type: 'bookmark', title: 'GitHub', url: 'https://github.com', position: 0 })],
    });
    expect(back.json<SyncResponse>().updated).toBe(1);
  });

  it('不安全 URL（javascript:）被拒绝并计入 skipped', async () => {
    const res = await sync({
      clientId: 'chrome-desktop-001',
      mode: 'incremental',
      changes: [
        { action: 'upsert', remoteId: '99', parentId: '1', type: 'bookmark', title: 'evil', url: 'javascript:alert(1)', position: 0 },
        { action: 'upsert', remoteId: '98', parentId: '1', type: 'bookmark', title: 'also evil', url: 'data:text/html,<script>', position: 1 },
        upsert({ remoteId: '97', parentId: '1', type: 'bookmark', title: 'good', url: 'https://example.com', position: 2 }),
      ],
    });
    const body = res.json<SyncResponse>();
    expect(body.skipped).toBe(2);
    expect(body.created).toBe(1);
  });

  it('不同客户端（多设备）数据互相独立', async () => {
    await sync({
      clientId: 'edge-laptop-001',
      mode: 'full',
      changes: [upsert({ remoteId: '100', parentId: '0', type: 'folder', title: 'Edge 书签栏', position: 0 })],
    });
    const laptop = await app.app.inject({ method: 'GET', url: '/api/bookmarks?client=edge-laptop-001', cookies });
    const laptopNodes = laptop.json<{ nodes: Array<{ remoteId: string }> }>().nodes;
    expect(laptopNodes).toHaveLength(1);
    expect(laptopNodes[0]?.remoteId).toBe('100');
  });

  it('畸形 payload 返回 400 INVALID_PAYLOAD', async () => {
    const res = await sync({ clientId: 'x', mode: 'bogus', changes: [] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_PAYLOAD');
  });

  it('撤销 Token 后同步返回 401 TOKEN_REVOKED', async () => {
    const token2 = await createSyncTokenViaApi(app.app, cookies, 'temp');
    const list = await app.app.inject({ method: 'GET', url: '/api/sync-tokens', cookies });
    const tokens = list.json<{ tokens: Array<{ id: string; name: string }> }>().tokens;
    const temp = tokens.find((t) => t.name === 'temp');
    expect(temp).toBeDefined();

    const revoke = await app.app.inject({ method: 'DELETE', url: `/api/sync-tokens/${temp!.id}`, cookies });
    expect(revoke.statusCode).toBe(200);

    const ping = await app.app.inject({
      method: 'GET',
      url: '/api/sync/ping',
      headers: { authorization: `Bearer ${token2}` },
    });
    expect(ping.statusCode).toBe(401);
    expect(ping.json().error.code).toBe('TOKEN_REVOKED');
  });

  it('同步状态统计（/api/sync/status）', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/sync/status', cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ clients: Array<{ clientId: string; bookmarkCount: number }>; totalDeleted: number }>();
    expect(body.clients.some((c) => c.clientId === 'chrome-desktop-001')).toBe(true);
    expect(body.clients.some((c) => c.clientId === 'edge-laptop-001')).toBe(true);
    expect(body.totalDeleted).toBeGreaterThan(0);
  });
});
