import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // 原生模块必须保持 external，不能被打包
  external: ['better-sqlite3', '@node-rs/argon2'],
});
