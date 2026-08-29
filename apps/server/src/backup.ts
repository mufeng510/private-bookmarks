import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { Config } from './config.js';
import { dataDir } from './config.js';
import type { DatabaseHandle } from './db/client.js';

const BACKUP_FILE_RE = /^bookmarks-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.db$/;

export function backupDir(config: Config): string {
  return path.join(dataDir(config), 'backups');
}

/**
 * 使用 SQLite 在线备份 API（不阻塞写入），输出到
 * /app/data/backups/bookmarks-<timestamp>.db，并按保留天数清理旧备份。
 */
export async function runBackup(config: Config, handle: DatabaseHandle): Promise<string | null> {
  if (!config.backupEnabled) return null;
  const dir = backupDir(config);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(dir, `bookmarks-${stamp}.db`);
  await handle.sqlite.backup(dest);
  pruneOldBackups(config, dir);
  return dest;
}

export function pruneOldBackups(config: Config, dir = backupDir(config)): number {
  if (!existsSync(dir)) return 0;
  const cutoff = Date.now() - config.backupRetentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!BACKUP_FILE_RE.test(name)) continue;
    const full = path.join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        unlinkSync(full);
        removed++;
      }
    } catch {
      // 单个文件清理失败不影响整体
    }
  }
  return removed;
}

/** 启动定时备份（进程内 setInterval，无需额外容器） */
export function startBackupScheduler(config: Config, handle: DatabaseHandle, log?: { info: (o: object, m: string) => void }): void {
  if (!config.backupEnabled) return;
  const intervalMs = config.backupIntervalHours * 60 * 60 * 1000;
  const timer = setInterval(() => {
    runBackup(config, handle)
      .then((dest) => {
        if (dest) log?.info({ dest }, 'database backup completed');
      })
      .catch((err) => {
        console.error('[backup] failed:', err instanceof Error ? err.message : err);
      });
  }, intervalMs);
  timer.unref();
}
