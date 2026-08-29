import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Config {
  env: string;
  port: number;
  host: string;
  /** 对外 baseUrl，如 https://bookmark.example.com；空表示由请求 Host 推断 */
  baseUrl: string;
  databaseUrl: string;
  webDist: string;
  adminUsername: string;
  /** 未提供时首次启动会随机生成并打印到日志 */
  adminPassword: string | null;
  /** 进程内生成的临时密钥（重启后失效），仅在未配置 SESSION_SECRET 时使用 */
  sessionSecret: string;
  sessionSecretConfigured: boolean;
  sessionTtlDays: number;
  loginRateLimitMax: number;
  syncRateLimitPerMinute: number;
  allowedOrigins: string[];
  trustProxy: boolean;
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupRetentionDays: number;
  logLevel: string;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // 本地：apps/server/dist 或 apps/server/src → apps/web/dist
  const defaultWebDist = path.resolve(here, '../../web/dist');

  const sessionSecret = env.SESSION_SECRET?.trim() || randomBytes(32).toString('base64url');

  return {
    env: env.NODE_ENV ?? 'development',
    port: num(env.PORT, 8080),
    host: env.HOST ?? '0.0.0.0',
    baseUrl: env.BASE_URL?.trim().replace(/\/+$/, '') ?? '',
    databaseUrl: env.DATABASE_URL ?? path.resolve(here, '../../../data/bookmarks.db'),
    webDist: env.WEB_DIST ?? defaultWebDist,
    adminUsername: env.ADMIN_USERNAME?.trim() || 'admin',
    adminPassword: env.ADMIN_PASSWORD?.trim() || null,
    sessionSecret,
    sessionSecretConfigured: Boolean(env.SESSION_SECRET?.trim()),
    sessionTtlDays: num(env.SESSION_TTL_DAYS, 30),
    loginRateLimitMax: num(env.LOGIN_RATE_LIMIT_MAX, 5),
    syncRateLimitPerMinute: num(env.SYNC_RATE_LIMIT_PER_MINUTE, 120),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY === 'true',
    backupEnabled: env.BACKUP_ENABLED !== 'false',
    backupIntervalHours: num(env.BACKUP_INTERVAL_HOURS, 24),
    backupRetentionDays: num(env.BACKUP_RETENTION_DAYS, 7),
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
  };
}

/** 数据库文件所在目录（备份也放在其下的 backups/ 子目录） */
export function dataDir(config: Config): string {
  return path.dirname(config.databaseUrl);
}
