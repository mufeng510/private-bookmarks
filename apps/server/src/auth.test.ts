import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, login, TEST_PASSWORD, TEST_USERNAME, type TestApp } from './test/helpers.js';

describe('认证', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('未登录访问受保护 API 返回 401 AUTH_REQUIRED，不返回任何书签数据', async () => {
    const res = await app.app.inject({ method: 'GET', url: '/api/bookmarks' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
    expect(body.nodes).toBeUndefined();
  });

  it('未登录带无效 Cookie 返回 SESSION_EXPIRED', async () => {
    const res = await app.app.inject({
      method: 'GET',
      url: '/api/bookmarks',
      cookies: { pb_session: 'invalid-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('SESSION_EXPIRED');
  });

  it('错误密码返回 401，信息不泄露用户是否存在', async () => {
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: TEST_USERNAME, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');

    const resUnknown = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'no-such-user', password: 'wrong-password' },
    });
    expect(resUnknown.statusCode).toBe(401);
    expect(resUnknown.json().error.message).toBe(res.json().error.message);
  });

  it('正确密码登录成功，Set-Cookie 为 HttpOnly + SameSite=Lax', async () => {
    const res = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === 'pb_session');
    expect(cookie).toBeDefined();
    const setCookieHeader = res.headers['set-cookie'] as unknown as string[];
    const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join('') : String(setCookieHeader);
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Lax');
  });

  it('Session 查询 / 登出后 Session 立即失效', async () => {
    const { cookies } = await login(app.app);
    const me = await app.app.inject({ method: 'GET', url: '/api/auth/session', cookies });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe(TEST_USERNAME);

    const out = await app.app.inject({ method: 'POST', url: '/api/auth/logout', cookies });
    expect(out.statusCode).toBe(200);

    const after = await app.app.inject({ method: 'GET', url: '/api/auth/session', cookies });
    expect(after.statusCode).toBe(401);
  });

  it('修改密码需要当前密码，且使其他 Session 失效', async () => {
    const sessionA = await login(app.app);
    const sessionB = await login(app.app);

    const bad = await app.app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      cookies: sessionA.cookies,
      payload: { currentPassword: 'wrong', newPassword: 'new-password-456' },
    });
    expect(bad.statusCode).toBe(401);

    const ok = await app.app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      cookies: sessionA.cookies,
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'new-password-456' },
    });
    expect(ok.statusCode).toBe(200);

    // 其他设备 Session 已失效
    const b = await app.app.inject({ method: 'GET', url: '/api/auth/session', cookies: sessionB.cookies });
    expect(b.statusCode).toBe(401);

    // 新密码可登录，旧密码不可
    const oldLogin = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
    });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: TEST_USERNAME, password: 'new-password-456' },
    });
    expect(newLogin.statusCode).toBe(200);

    // 恢复原密码，避免影响后续用例
    const restoreCookies: Record<string, string> = {};
    for (const c of newLogin.cookies) restoreCookies[c.name] = c.value;
    const restore = await app.app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      cookies: restoreCookies,
      payload: { currentPassword: 'new-password-456', newPassword: TEST_PASSWORD },
    });
    expect(restore.statusCode).toBe(200);
  });

  it('退出所有设备后全部 Session 失效', async () => {
    const a = await login(app.app);
    const b = await login(app.app);
    const res = await app.app.inject({ method: 'POST', url: '/api/auth/logout-all', cookies: a.cookies });
    expect(res.statusCode).toBe(200);

    const bAfter = await app.app.inject({ method: 'GET', url: '/api/auth/session', cookies: b.cookies });
    expect(bAfter.statusCode).toBe(401);
  });
});

describe('登录限流', () => {
  it('超过 LOGIN_RATE_LIMIT_MAX 次后返回 429 RATE_LIMITED', async () => {
    const app = await buildTestApp({ loginRateLimitMax: 3 });
    try {
      for (let i = 0; i < 3; i++) {
        await app.app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { username: TEST_USERNAME, password: 'bad' },
        });
      }
      const res = await app.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_USERNAME, password: TEST_PASSWORD },
      });
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe('RATE_LIMITED');
    } finally {
      await app.close();
    }
  });
});
