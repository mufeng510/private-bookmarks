import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // better-sqlite3 为原生模块，使用 forks 池更稳定
    pool: 'forks',
    testTimeout: 20000,
  },
});
