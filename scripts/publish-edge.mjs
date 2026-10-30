#!/usr/bin/env node
/**
 * Microsoft Edge Add-ons 上传 / 发布脚本（CI 用）。
 * 使用 Partner Center Update REST API v1.1（ApiKey + ClientID 认证）。
 *
 * 前提：该扩展必须已在 Partner Center 手动创建过。本 API 只能更新已有产品，
 *       不能新建产品。新扩展需先在 Partner Center 手动上架一次，拿到产品 ID。
 * 参考：https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api
 *
 * 依赖 GitHub Secrets：
 *   EDGE_API_KEY     Partner Center Publish API 生成的 API Key
 *   EDGE_CLIENT_ID   Partner Center Publish API 生成的 Client ID
 *   EDGE_PRODUCT_ID  扩展在 Partner Center 中的产品 ID（GUID）
 *
 * 用法：
 *   node scripts/publish-edge.mjs upload   # 仅上传新版本包到草稿提交
 *   node scripts/publish-edge.mjs publish  # 将当前草稿提交提交发布（需先 upload）
 *
 * 注意：Edge 扩展商店审核由 Microsoft 控制，通过前不会公开。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const API_KEY = process.env.EDGE_API_KEY;
const CLIENT_ID = process.env.EDGE_CLIENT_ID;
const PRODUCT_ID = process.env.EDGE_PRODUCT_ID;

for (const [name, value] of Object.entries({
  EDGE_API_KEY: API_KEY,
  EDGE_CLIENT_ID: CLIENT_ID,
  EDGE_PRODUCT_ID: PRODUCT_ID,
})) {
  if (!value) {
    console.error(`缺少环境变量 ${name}（请在 GitHub Secrets 中配置）`);
    process.exit(1);
  }
}

const API_ROOT = 'https://api.addons.microsoftedge.microsoft.com';
const version = JSON.parse(
  readFileSync(path.join(repoRoot, 'apps/extension/package.json'), 'utf-8'),
).version;
const zipPath = path.join(
  repoRoot,
  `apps/extension/private-bookmarks-extension-v${version}.zip`,
);
const zip = readFileSync(zipPath);

const headers = {
  Authorization: `ApiKey ${API_KEY}`,
  'X-ClientID': CLIENT_ID,
};

function operationIdFromLocation(location) {
  // Location 形如 https://api.addons.microsoftedge.microsoft.com/v1/products/.../operations/<id>
  const parts = location.split('/');
  return parts[parts.length - 1];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 轮询某个操作的状态，直到完成或失败
async function pollStatus(operationId, kind) {
  let url;
  if (kind === 'publish') {
    url = `${API_ROOT}/v1/products/${PRODUCT_ID}/submissions/operations/${operationId}`;
  } else {
    url = `${API_ROOT}/v1/products/${PRODUCT_ID}/submissions/draft/package/operations/${operationId}`;
  }

  const maxRetries = 30; // 最多等待约 150 秒
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(
        `查询${kind}状态失败: HTTP ${res.status} ${await res.text()}`,
      );
    }
    const data = await res.json();
    const status = data.status;
    console.log(`${kind}状态 (${i + 1}/${maxRetries}): ${status}`);
    if (status === 'Completed') {
      console.log(`${kind}完成。`);
      return;
    }
    if (status === 'Failed') {
      throw new Error(`${kind}失败: ${JSON.stringify(data)}`);
    }
    // InProgress 等，继续等待
    await sleep(5000);
  }
  throw new Error(
    `${kind}超时：操作 ${operationId} 未在预期时间内完成`,
  );
}

async function upload() {
  const url = `${API_ROOT}/v1/products/${PRODUCT_ID}/submissions/draft/package`;
  console.log(
    `上传 ${path.basename(zipPath)} → Edge Add-ons (${PRODUCT_ID})`,
  );
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/zip',
    },
    body: zip,
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`上传失败: HTTP ${res.status} ${body}`);
  }
  const location = res.headers.get('location') || '';
  const operationId = operationIdFromLocation(location);
  console.log(
    '上传已提交，operationId:',
    operationId || '(未返回 Location)',
  );
  if (operationId) {
    await pollStatus(operationId, '上传');
  }
  console.log('上传完成。');
}

async function publish() {
  const url = `${API_ROOT}/v1/products/${PRODUCT_ID}/submissions`;
  const body = JSON.stringify({
    notes: 'Auto-publish via GitHub Actions CI/CD',
  });
  console.log('提交 Edge Add-ons 发布（草稿提交）…');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`发布失败: HTTP ${res.status} ${text}`);
  }
  const location = res.headers.get('location') || '';
  const operationId = operationIdFromLocation(location);
  console.log(
    '发布已提交，operationId:',
    operationId || '(未返回 Location)',
  );
  if (operationId) {
    await pollStatus(operationId, '发布');
  }
  console.log('发布提交完成，等待 Microsoft 审核。');
}

const command = process.argv[2];
if (command === 'upload') {
  await upload();
} else if (command === 'publish') {
  await publish();
} else {
  console.error('用法: node scripts/publish-edge.mjs <upload|publish>');
  process.exit(1);
}
