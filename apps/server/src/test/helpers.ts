import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, type Config } from '../config.js';
import { buildApp, type BuiltApp } from '../app.js';

export const TEST_USERNAME = 'admin';
export const TEST_PASSWORD = 'test-password-123';

export interface TestApp extends BuiltApp {
  config: Config;
}

export async function buildTestApp(overrides: Partial<Config> = {}, logger?: Record<string, unknown>): Promise<TestApp> {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pb-test-'));
  const config: Config = {
    ...loadConfig({
      NODE_ENV: 'test',
      PORT: '0',
      BASE_URL: 'http://localhost:8080',
      ADMIN_USERNAME: TEST_USERNAME,
      ADMIN_PASSWORD: TEST_PASSWORD,
      SESSION_SECRET: 'test-secret-do-not-use',
      DATABASE_URL: path.join(dir, 'bookmarks.db'),
      LOGIN_RATE_LIMIT_MAX: '100',
      BACKUP_ENABLED: 'false',
      LOG_LEVEL: 'silent',
    }),
    ...overrides,
  };
  const built = await buildApp(config, logger ? { logger } : undefined);
  return { ...built, config };
}

export interface LoggedIn {
  cookies: Record<string, string>;
}

/** 通过 API 登录并返回 Cookie */
export async function login(app: TestApp['app'], username = TEST_USERNAME, password = TEST_PASSWORD): Promise<LoggedIn> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  }
  const cookies: Record<string, string> = {};
  for (const c of res.cookies) cookies[c.name] = c.value;
  return { cookies };
}

/** 通过网站设置页创建 Sync Token，返回明文 token */
export async function createSyncTokenViaApi(app: TestApp['app'], cookies: LoggedIn['cookies'], name = 'test-token'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sync-tokens',
    cookies,
    payload: { name },
  });
  if (res.statusCode !== 200) {
    throw new Error(`create token failed: ${res.statusCode} ${res.body}`);
  }
  const body = res.json<{ token: string }>();
  return body.token;
}

export function upsert(change: {
  remoteId: string;
  parentId?: string;
  type: 'bookmark' | 'folder';
  title: string;
  url?: string | null;
  position?: number;
}) {
  return {
    action: 'upsert' as const,
    remoteId: change.remoteId,
    parentId: change.parentId ?? '0',
    type: change.type,
    title: change.title,
    url: change.url ?? null,
    position: change.position ?? 0,
  };
}

export function del(remoteId: string) {
  return { action: 'delete' as const, remoteId };
}
