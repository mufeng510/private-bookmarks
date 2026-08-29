import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

export interface DatabaseHandle {
  db: Db;
  sqlite: Database.Database;
  close(): void;
}

/**
 * 打开 SQLite 数据库并执行迁移。
 * 启用 WAL 模式，适合 NAS 上单进程读多写少的场景。
 */
export function createDatabase(databaseUrl: string, migrationsFolder?: string): DatabaseHandle {
  const dir = path.dirname(databaseUrl);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const sqlite = new Database(databaseUrl);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  const folder = migrationsFolder ?? defaultMigrationsFolder();
  migrate(db, { migrationsFolder: folder });

  return {
    db,
    sqlite,
    close() {
      sqlite.close();
    },
  };
}

function defaultMigrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  // 兼容三种布局：源码 src/db → ../../drizzle；打包 dist → ../drizzle；Docker WORKDIR → drizzle
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const candidate of ['../drizzle', '../../drizzle', 'drizzle']) {
    const dir = path.resolve(here, candidate);
    if (existsSync(path.join(dir, 'meta', '_journal.json'))) return dir;
  }
  return path.resolve(here, '../../drizzle');
}

export function nowIso(): string {
  return new Date().toISOString();
}
