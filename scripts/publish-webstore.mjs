#!/usr/bin/env node
/**
 * Chrome Web Store 上传 / 发布脚本（CI 用）。
 *
 * 依赖 GitHub Secrets：
 *   CHROME_EXTENSION_ID   扩展 ID（Chrome Web Store 后台可见）
 *   CHROME_CLIENT_ID      Google OAuth Client ID
 *   CHROME_CLIENT_SECRET  Google OAuth Client Secret
 *   CHROME_REFRESH_TOKEN  OAuth Refresh Token（见 README「Chrome Web Store 发布」）
 *
 * 用法：
 *   node scripts/publish-webstore.mjs upload   # 仅上传新版本包
 *   node scripts/publish-webstore.mjs publish  # 上传 + 提交审核发布
 *
 * 注意：上传后 Google 审核需要时间，不能保证立即公开。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const EXTENSION_ID = process.env.CHROME_EXTENSION_ID;
const CLIENT_ID = process.env.CHROME_CLIENT_ID;
const CLIENT_SECRET = process.env.CHROME_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.CHROME_REFRESH_TOKEN;

for (const [name, value] of Object.entries({
  CHROME_EXTENSION_ID: EXTENSION_ID,
  CHROME_CLIENT_ID: CLIENT_ID,
  CHROME_CLIENT_SECRET: CLIENT_SECRET,
  CHROME_REFRESH_TOKEN: REFRESH_TOKEN,
})) {
  if (!value) {
    console.error(`缺少环境变量 ${name}（请在 GitHub Secrets 中配置）`);
    process.exit(1);
  }
}

const zipPath = path.join(repoRoot, 'apps/extension/private-bookmarks-extension-v' + JSON.parse(readFileSync(path.join(repoRoot, 'apps/extension/package.json'), 'utf-8')).version + '.zip');
const zip = readFileSync(zipPath);

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`获取 access token 失败: HTTP ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

const UPLOAD_ENDPOINT = (id: string) => `https://chromewebstore.googleapis.com/upload/chromewebstore/v1.1/items/${id}`;
const PUBLISH_ENDPOINT = (id: string) => `https://chromewebstore.googleapis.com/chromewebstore/v1.1/items/${id}/publish`;

async function upload(): Promise<void> {
  const token = await getAccessToken();
  console.log(`上传 ${path.basename(zipPath)} → Chrome Web Store (${EXTENSION_ID})`);
  const res = await fetch(UPLOAD_ENDPOINT(EXTENSION_ID!), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-api-version': '2',
    },
    body: zip,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`上传失败: HTTP ${res.status} ${body}`);
  console.log('上传成功:', body);
}

async function publish(): Promise<void> {
  const token = await getAccessToken();
  console.log('提交审核发布（target=default）…');
  const res = await fetch(PUBLISH_ENDPOINT(EXTENSION_ID!), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-goog-api-version': '2' },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`发布失败: HTTP ${res.status} ${body}`);
  console.log('已提交发布:', body);
  console.log('注意：Chrome Web Store 审核由 Google 控制，通过前不会公开。');
}

const command = process.argv[2];
if (command === 'upload') {
  await upload();
} else if (command === 'publish') {
  await publish();
} else {
  console.error('用法: node scripts/publish-webstore.mjs <upload|publish>');
  process.exit(1);
}
