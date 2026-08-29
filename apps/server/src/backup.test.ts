import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, utimesSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, type Config } from './config.js';
import { pruneOldBackups, backupDir } from './backup.js';
import { createDatabase, type DatabaseHandle } from './db/client.js';

function tempConfig(dir: string): Config {
  return loadConfig({
    DATABASE_URL: path.join(dir, 'bookmarks.db'),
    BACKUP_ENABLED: 'true',
    BACKUP_RETENTION_DAYS: '7',
  });
}

describe('自动备份', () => {
  let dir: string;
  let config: Config;
  let handle: DatabaseHandle;

  beforeAll(() => {
    dir = mkdirSync(path.join(os.tmpdir(), `pb-backup-${Date.now()}`), { recursive: true })!;
    config = tempConfig(dir);
    handle = createDatabase(config.databaseUrl);
  });

  afterAll(() => {
    handle.close();
  });

  it('创建在线备份文件', async () => {
    const { runBackup } = await import('./backup.js');
    const dest = await runBackup(config, handle);
    expect(dest).toBeTruthy();
    expect(existsSync(dest!)).toBe(true);
  });

  it('清理超过保留期的旧备份，新备份保留', async () => {
    const dirPath = backupDir(config);
    const old = path.join(dirPath, 'bookmarks-2020-01-01T00-00-00.db');
    const fresh = path.join(dirPath, 'bookmarks-2099-01-01T00-00-00.db');
    writeFileSync(old, 'old');
    writeFileSync(fresh, 'fresh');
    const oldTime = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    utimesSync(old, oldTime, oldTime);

    const removed = pruneOldBackups(config);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(readdirSync(dirPath).length).toBeGreaterThanOrEqual(1);
  });
});
