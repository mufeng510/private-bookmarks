#!/usr/bin/env node
/** 打包发布 zip：private-bookmarks-extension-v<version>.zip */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, '../package.json'), 'utf-8'));
const dist = path.join(here, '../dist');
const outName = `private-bookmarks-extension-v${pkg.version}.zip`;
const outPath = path.join(here, '../', outName);

if (!existsSync(path.join(dist, 'manifest.json'))) {
  console.error('dist 不存在或尚未构建，请先运行 pnpm build');
  process.exit(1);
}

rmSync(outPath, { force: true });
execFileSync('zip', ['-r', '-q', outPath, '.', '-x', '*.map'], { cwd: dist, stdio: 'inherit' });
console.log(`packed → ${outPath}`);
