import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTestApp, login, TEST_PASSWORD, TEST_USERNAME, type TestApp } from './test/helpers.js';

describe('导入 / 导出 API', () => {
  let app: TestApp;
  let cookies: Record<string, string>;

  beforeAll(async () => {
    app = await buildTestApp();
    cookies = (await login(app.app)).cookies;
  });

  afterAll(async () => {
    await app.close();
  });

  const HTML = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<DL><p>',
    '  <DT><H3>书签栏</H3>',
    '  <DL><p>',
    '    <DT><H3>开发</H3>',
    '    <DL><p>',
    '      <DT><A HREF="https://github.com/" ADD_DATE="1690000000">GitHub</A>',
    '      <DT><A HREF="javascript:alert(1)">evil</A>',
    '    </DL><p>',
    '    <DT><A HREF="https://claude.ai/">Claude</A>',
    '  </DL><p>',
    '</DL><p>',
  ].join('\n');

  it('预览：上传 HTML 返回解析结果（含 skipped 统计）', async () => {
    const boundary = '----pbtestboundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="bookmarks.html"',
      'Content-Type: text/html',
      '',
      HTML,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const res = await app.app.inject({
      method: 'POST',
      url: '/api/import/preview',
      cookies,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const preview = res.json<{ bookmarkCount: number; folderCount: number; skipped: number; roots: unknown[] }>();
    expect(preview.bookmarkCount).toBe(2);
    expect(preview.folderCount).toBe(2);
    expect(preview.skipped).toBe(1);

    // 确认导入
    const confirm = await app.app.inject({
      method: 'POST',
      url: '/api/import',
      cookies,
      payload: { roots: preview.roots },
    });
    expect(confirm.statusCode).toBe(200);
    const stats = confirm.json<{ created: number; skipped: number }>();
    expect(stats.created).toBe(4); // 2 文件夹 + 2 书签（evil 已被 parse 阶段跳过）
    expect(stats.skipped).toBe(0);

    // 导入数据进入独立 "import" 命名空间
    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks?client=import', cookies });
    const nodes = list.json<{ nodes: Array<{ url: string | null; title: string }> }>().nodes;
    expect(nodes).toHaveLength(4); // 2 folders + 2 bookmarks
    expect(nodes.some((n) => n.url === 'javascript:alert(1)')).toBe(false);
  });

  it('重复导入：书签按 URL 去重，文件夹按名称合并', async () => {
    const boundary = '----pbtestboundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="bookmarks.html"',
      'Content-Type: text/html',
      '',
      HTML,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const preview = await app.app.inject({
      method: 'POST',
      url: '/api/import/preview',
      cookies,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    const confirm = await app.app.inject({
      method: 'POST',
      url: '/api/import',
      cookies,
      payload: { roots: preview.json<{ roots: unknown[] }>().roots },
    });
    const stats = confirm.json<{ created: number; skipped: number }>();
    expect(stats.created).toBe(0);
    expect(stats.skipped).toBe(2); // 两个 URL 都已存在

    const list = await app.app.inject({ method: 'GET', url: '/api/bookmarks?client=import', cookies });
    expect(list.json<{ nodes: unknown[] }>().nodes).toHaveLength(4);
  });

  it('导出 HTML 为 Chrome 兼容格式（可再导入 Chrome）', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/export?format=html&client=import', cookies });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-disposition']).toContain('attachment');
    const html = res.body;
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('https://github.com/');
    expect(html).toContain('开发');
  });

  it('导出 JSON 包含全部字段', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/export?format=json&client=import', cookies });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ exportedAt: string; nodes: Array<{ url: string | null; type: string }> }>();
    expect(body.exportedAt).toBeDefined();
    expect(body.nodes.filter((n) => n.type === 'bookmark')).toHaveLength(2);
  });

  it('导出未登录返回 401', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/export?format=html' });
    expect(res.statusCode).toBe(401);
  });
});

describe('安全（headers / robots / CSRF / CORS / 日志）', () => {
  it('robots.txt 禁止全站索引，且带 X-Robots-Tag', async () => {
    const app = await buildTestApp();
    try {
      const res = await app.app.inject({ method: 'GET', url: '/robots.txt' });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('Disallow: /');
      expect(res.headers['x-robots-tag']).toContain('noindex');
    } finally {
      await app.close();
    }
  });

  it('HTML 页面带 CSP 与安全响应头；SPA 路由回退 index.html', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pb-web-'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>app</body></html>');
    mkdirSync(path.join(dir, 'assets'));
    const app = await buildTestApp({ webDist: dir });
    try {
      const home = await app.app.inject({ method: 'GET', url: '/' });
      expect(home.statusCode).toBe(200);
      expect(home.headers['content-security-policy']).toContain("default-src 'self'");
      expect(home.headers['x-frame-options']).toBe('DENY');
      expect(home.headers['x-content-type-options']).toBe('nosniff');

      const spa = await app.app.inject({ method: 'GET', url: '/bookmarks' });
      expect(spa.statusCode).toBe(200);
      expect(spa.body).toContain('app');

      const api404 = await app.app.inject({ method: 'GET', url: '/api/nope' });
      expect(api404.statusCode).toBe(404);
      expect(api404.json().error.code).toBe('NOT_FOUND');
    } finally {
      await app.close();
    }
  });

  it('跨域状态修改请求被 CSRF 防护拒绝', async () => {
    const app = await buildTestApp();
    try {
      const evil = await app.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'https://evil.example.com' },
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      expect(evil.statusCode).toBe(403);
      expect(evil.json().error.code).toBe('FORBIDDEN_ORIGIN');

      const sameOrigin = await app.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: { origin: 'http://localhost:8080' },
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      expect(sameOrigin.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('CORS 只放行白名单来源，绝不返回 *', async () => {
    const app = await buildTestApp({ allowedOrigins: ['chrome-extension://abcdefabcdef'] });
    try {
      const pre = await app.app.inject({
        method: 'OPTIONS',
        url: '/api/sync',
        headers: { origin: 'chrome-extension://abcdefabcdef', 'access-control-request-method': 'POST' },
      });
      expect(pre.statusCode).toBe(204);
      expect(pre.headers['access-control-allow-origin']).toBe('chrome-extension://abcdefabcdef');

      const other = await app.app.inject({
        method: 'GET',
        url: '/api/bookmarks',
        headers: { origin: 'https://evil.example.com' },
      });
      expect(other.headers['access-control-allow-origin']).toBeUndefined();
      expect(other.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('日志中不出现 Sync Token 明文与密码', async () => {
    const chunks: string[] = [];
    const stream = {
      write(chunk: string) {
        chunks.push(chunk);
      },
    };
    const app = await buildTestApp({ logLevel: 'info' }, { level: 'info', stream } as never);

    try {
      const cookies = (await login(app.app)).cookies;
      const tokenRes = await app.app.inject({
        method: 'POST',
        url: '/api/sync-tokens',
        cookies,
        payload: { name: 'log-test' },
      });
      const token = tokenRes.json<{ token: string }>().token;
      expect(token).toBeTruthy();

      await app.app.inject({
        method: 'POST',
        url: '/api/sync',
        headers: { authorization: `Bearer ${token}` },
        payload: { clientId: 'c', mode: 'incremental', changes: [] },
      });

      const all = chunks.join('');
      expect(all).not.toContain(token);
      expect(all).not.toContain(TEST_PASSWORD);
    } finally {
      await app.close();
    }
  });
});
