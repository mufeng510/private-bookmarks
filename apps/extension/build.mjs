#!/usr/bin/env node
/**
 * 构建浏览器扩展：
 * - esbuild 打包 background / popup / options
 * - 复制 manifest.json、html、css、icons 到 dist/
 * 输出目录：dist/（Chrome 加载已解压的扩展程序时选择该目录）
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'dist');
const watch = process.argv.includes('--watch');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = {
  'background.js': 'src/background/index.ts',
  'popup.js': 'src/popup/popup.ts',
  'options.js': 'src/options/options.ts',
};

const commonOptions = {
  bundle: true,
  format: 'esm',
  target: 'chrome110',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: false,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
};

if (watch) {
  const contexts = await Promise.all(
    Object.entries(entries).map(([outFile, entry]) =>
      build({ ...commonOptions, entryPoints: [path.join(here, entry)], outfile: path.join(outDir, outFile) }).then((ctx) => ctx),
    ),
  );
  void contexts;
  console.log('[watch] mode: 初始构建完成，等待文件变化…');
  // esbuild watch 需要每个 entry 返回 context；简化处理：watch 仅用于本地调试
  for (const [outFile, entry] of Object.entries(entries)) {
    void build({
      ...commonOptions,
      entryPoints: [path.join(here, entry)],
      outfile: path.join(outDir, outFile),
      watch: true,
    }).then((ctx) => ctx);
  }
} else {
  for (const [outFile, entry] of Object.entries(entries)) {
    await build({
      ...commonOptions,
      entryPoints: [path.join(here, entry)],
      outfile: path.join(outDir, outFile),
    });
  }
}

// manifest：版本与 package.json 保持一致（CI 校验）
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf-8'));
const manifest = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf-8'));
if (manifest.version !== pkg.version) {
  console.error(`版本不一致: package.json=${pkg.version} manifest.json=${manifest.version}`);
  process.exit(1);
}
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 静态资源
for (const src of ['src/popup/popup.html', 'src/popup/popup.css', 'src/options/options.html']) {
  cpSync(path.join(here, src), path.join(outDir, path.basename(src)));
}
cpSync(path.join(here, 'icons'), path.join(outDir, 'icons'), { recursive: true });

console.log(`extension built → ${outDir}`);
