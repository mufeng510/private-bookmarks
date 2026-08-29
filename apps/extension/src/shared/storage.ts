import type { Snapshot } from '@private-bookmarks/sync-protocol';

/**
 * 扩展本地配置与状态存储（chrome.storage.local）。
 * Sync Token 只存放在 chrome.storage.local，绝不写入日志。
 */

export interface ExtensionSettings {
  serverUrl: string;
  syncToken: string;
  clientId: string;
  /** 定时全量同步周期（分钟），0 表示关闭 */
  autoSyncPeriodMinutes: number;
  /** 是否启用书签事件触发的增量同步 */
  eventSyncEnabled: boolean;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncMode: 'full' | 'incremental' | null;
  lastSyncStatus: 'success' | 'invalid-token' | 'network-error' | 'server-error' | 'rate-limited' | null;
  lastError: string | null;
  lastStats: { created: number; updated: number; deleted: number; unchanged: number; skipped: number } | null;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  serverUrl: '',
  syncToken: '',
  clientId: '',
  autoSyncPeriodMinutes: 360,
  eventSyncEnabled: true,
};

export const DEFAULT_STATUS: SyncStatus = {
  lastSyncAt: null,
  lastSyncMode: null,
  lastSyncStatus: null,
  lastError: null,
  lastStats: null,
};

const SETTINGS_KEY = 'settings';
const SNAPSHOT_KEY = 'snapshot';
const STATUS_KEY = 'status';

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<ExtensionSettings>;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...partial } });
}

export async function getStatus(): Promise<SyncStatus> {
  const result = await chrome.storage.local.get(STATUS_KEY);
  return { ...DEFAULT_STATUS, ...((result[STATUS_KEY] ?? {}) as Partial<SyncStatus>) };
}

export async function saveStatus(partial: Partial<SyncStatus>): Promise<void> {
  const current = await getStatus();
  await chrome.storage.local.set({ [STATUS_KEY]: { ...current, ...partial } });
}

export async function loadSnapshot(): Promise<Snapshot> {
  const result = await chrome.storage.local.get(SNAPSHOT_KEY);
  return (result[SNAPSHOT_KEY] ?? {}) as Snapshot;
}

export async function saveSnapshot(snapshot: Snapshot): Promise<void> {
  await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshot });
}

/** 首次安装生成 Client ID（UUID），卸载重装会产生新 ID（允许） */
export async function ensureClientId(): Promise<string> {
  const settings = await getSettings();
  if (settings.clientId) return settings.clientId;
  const clientId = crypto.randomUUID();
  await saveSettings({ clientId });
  return clientId;
}

export function isConfigured(settings: ExtensionSettings): boolean {
  return Boolean(settings.serverUrl && settings.syncToken && settings.clientId);
}

/** 规范化服务器地址：去掉末尾斜杠；仅接受 http/https */
export function normalizeServerUrl(raw: string): string | null {
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return value;
  } catch {
    return null;
  }
}

export const SYNC_TOKEN_STORAGE_WARNING = 'Sync Token 保存在 chrome.storage.local，仅发送到你配置的服务器。';
