#!/usr/bin/env node
/**
 * 一键发布：改版本号 → 提交 → 打 tag → 推送。
 * 推送后 CI 自动完成：Docker Hub 版本镜像、GitHub Release（含扩展 zip）、Chrome Web Store。
 *
 * 用法：
 *   pnpm release 1.2.0            # 指定版本号
 *   pnpm release --patch          # 1.2.0 → 1.2.1
 *   pnpm release --minor          # 1.2.0 → 1.3.0
 *   pnpm release --major          # 1.2.0 → 2.0.0
 *   pnpm release 1.2.0 --dry-run  # 只打印将要执行的操作
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const run = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: 'pipe', encoding: 'utf-8', ...opts }).trim();
const readJSON = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf-8'));
const writeJSON = (rel, data) => writeFileSync(path.join(root, rel), JSON.stringify(data, null, 2) + '\n');

// ---------- 解析参数 ----------
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const bumpArg = args.find((a) => !a.startsWith('--'));

const extensionPkg = readJSON('apps/extension/package.json');
let version;

if (bumpArg) {
  if (!/^\d+\.\d+\.\d+$/.test(bumpArg)) {
    console.error(`❌ 版本号格式应为 X.Y.Z，收到："${bumpArg}"`);
    process.exit(1);
  }
  version = bumpArg;
} else if (['--patch', '--minor', '--major'].some((a) => args.includes(a))) {
  const [x, y, z] = extensionPkg.version.split('.').map(Number);
  version =
    args.includes('--major') ? `${x + 1}.0.0`
    : args.includes('--minor') ? `${x}.${y + 1}.0`
    : `${x}.${y}.${z + 1}`;
} else {
  console.error('用法: pnpm release <X.Y.Z | --patch | --minor | --major> [--dry-run]');
  process.exit(1);
}

const cmp = (a, b) => {
  const [x1, y1, z1] = a.split('.').map(Number);
  const [x2, y2, z2] = b.split('.').map(Number);
  return x1 - x2 || y1 - y2 || z1 - z2;
};

// ---------- 前置校验 ----------
const tag = `v${version}`;
const current = extensionPkg.version;
const branch = run('git rev-parse --abbrev-ref HEAD');

if (cmp(version, current) < 0) {
  console.error(`❌ 新版本 ${version} 小于当前版本 ${current}`);
  process.exit(1);
}
let tagExists = false;
try {
  run(`git rev-parse -q --verify "refs/tags/${tag}"`);
  tagExists = true;
} catch {
  // tag 不存在，继续
}
if (tagExists) {
  console.error(`❌ 标签 ${tag} 已存在，请换一个版本号`);
  process.exit(1);
}
const dirty = run('git status --porcelain');
if (dirty && !dryRun) {
  console.error('❌ 工作区不干净，请先提交或暂存（git stash）未提交的改动：');
  console.error(dirty);
  process.exit(1);
}

// ---------- 待更新的版本文件 ----------
const versionedFiles = [
  'package.json',
  'packages/shared/package.json',
  'packages/sync-protocol/package.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'apps/extension/package.json',
];

console.log(`发布版本 ${tag}（当前 ${current}，分支 ${branch}）${dryRun ? ' [dry-run]' : ''}\n`);

const plan = [];
for (const file of versionedFiles) {
  const data = readJSON(file);
  if (data.version !== version) plan.push(['update', file, `${data.version} → ${version}`]);
}
const manifest = readJSON('apps/extension/manifest.json');
if (manifest.version !== version) plan.push(['update', 'apps/extension/manifest.json', `${manifest.version} → ${version}`]);
if (dirty || cmp(version, current) !== 0) plan.push(['commit', 'chore(release): ' + tag, '']);
plan.push(['tag', tag, '']);
plan.push(['push', `${branch} + ${tag}`, '']);

for (const [action, target, detail] of plan) {
  console.log(`  ${action.padEnd(7)} ${target}${detail ? '  (' + detail + ')' : ''}`);
}

if (dryRun) {
  console.log('\n[dry-run] 未执行任何修改。去掉 --dry-run 正式发布。');
  process.exit(0);
}

// ---------- 执行 ----------
for (const file of versionedFiles) {
  const data = readJSON(file);
  data.version = version;
  writeJSON(file, data);
}
manifest.version = version;
writeJSON('apps/extension/manifest.json', manifest);

run('git add -A');
const staged = run('git status --porcelain');
let commitNote;
if (staged) {
  run(`git commit -m ${JSON.stringify('chore(release): ' + tag)}`);
  commitNote = `已提交 chore(release): ${tag}`;
} else {
  commitNote = '版本号无变化，跳过提交（直接在当前 HEAD 打标签）';
}

run(`git tag -a ${tag} -m ${JSON.stringify(tag)}`);
run(`git push origin ${branch} ${tag}`);

console.log(`\n✅ ${tag} 已推送到 GitHub`);
console.log(`   ${commitNote}`);
console.log('\nCI 将自动完成（可在 https://github.com/mufeng510/private-bookmarks/actions 查看）：');
const [maj, min] = version.split('.');
console.log(`  1. Docker Hub 镜像标签：${version}、${maj}.${min}、latest`);
console.log('  2. GitHub Release（含扩展 zip）');
console.log('  3. Chrome Web Store 上传与提交发布（需已配置 CHROME_* Secrets）');
