import type { Snapshot } from '@private-bookmarks/sync-protocol';

/**
 * 扩展配置与状态存储。
 *
 * 存储分层：
 * - 用户自定义设置（服务器地址、Sync Token、同步周期、事件同步开关）存
 *   chrome.storage.sync，跟随浏览器账号自动同步：Chrome 走 Google 账号、
 *   Edge 走 Microsoft 账号，重装系统 / 新电脑登录同一账号即自动恢复配置。
 * - Client ID 是"本机标识"，存 chrome.storage.local（跟随设备而非账号）——
 *   多台设备登录同一账号时会各自保留独立的设备源，避免书签数据互相覆盖。
 *   重装系统后如需延续旧设备数据，在设置页手动填回同一个 ID 即可。
 * - 书签快照与同步状态是本机运行时数据，存 chrome.storage.local。
 *
 * Sync Token 只存放在 chrome 存储中，绝不写入日志。
 */

export interface ExtensionSettings {
  serverUrl: string;
  syncToken: string;
  /** 本机标识：存 local（跟随设备），不跟随浏览器账号同步 */
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

/** 跟随浏览器账号同步的设置（chrome.storage.sync） */
export const SYNC_SETTINGS_KEY = 'settings';
/** 本机设备标识（chrome.storage.local） */
export const DEVICE_SETTINGS_KEY = 'device';
/** v1.1.0 及之前全部存在 local 'settings' 的旧键，升级时迁移 */
const LEGACY_SETTINGS_KEY = 'settings';
const SNAPSHOT_KEY = 'snapshot';
const STATUS_KEY = 'status';

interface SyncedSettings {
  serverUrl: string;
  syncToken: string;
  autoSyncPeriodMinutes: number;
  eventSyncEnabled: boolean;
}

const DEFAULT_SYNCED: SyncedSettings = {
  serverUrl: '',
  syncToken: '',
  autoSyncPeriodMinutes: 360,
  eventSyncEnabled: true,
};

async function readSyncedSettings(): Promise<SyncedSettings> {
  const result = await chrome.storage.sync.get(SYNC_SETTINGS_KEY);
  return { ...DEFAULT_SYNCED, ...((result[SYNC_SETTINGS_KEY] ?? {}) as Partial<SyncedSettings>) };
}

async function writeSyncedSettings(patch: Partial<SyncedSettings>): Promise<void> {
  const current = await readSyncedSettings();
  await chrome.storage.sync.set({ [SYNC_SETTINGS_KEY]: { ...current, ...patch } });
}

async function readDeviceClientId(): Promise<string> {
  const result = await chrome.storage.local.get(DEVICE_SETTINGS_KEY);
  const device = (result[DEVICE_SETTINGS_KEY] ?? {}) as { clientId?: string };
  return device.clientId ?? '';
}

/**
 * 读取合并后的完整设置（同步设置 + 本机 Client ID）。
 * 兼容 v1.1.0 及之前的旧存储布局：首次读取时把旧 local 设置迁移到
 * sync（用户偏好）+ local device（Client ID），此后以新布局为准。
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const [syncedResult, localResult] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTINGS_KEY),
    chrome.storage.local.get([DEVICE_SETTINGS_KEY, LEGACY_SETTINGS_KEY]),
  ]);

  const legacy = localResult[LEGACY_SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  if (!syncedResult[SYNC_SETTINGS_KEY] && legacy) {
    const synced: SyncedSettings = {
      serverUrl: legacy.serverUrl ?? '',
      syncToken: legacy.syncToken ?? '',
      autoSyncPeriodMinutes: legacy.autoSyncPeriodMinutes ?? DEFAULT_SYNCED.autoSyncPeriodMinutes,
      eventSyncEnabled: legacy.eventSyncEnabled ?? true,
    };
    const clientId = legacy.clientId ?? '';
    await chrome.storage.sync.set({ [SYNC_SETTINGS_KEY]: synced });
    await chrome.storage.local.set({ [DEVICE_SETTINGS_KEY]: { clientId } });
    await chrome.storage.local.remove(LEGACY_SETTINGS_KEY);
    return { ...synced, clientId };
  }

  const synced = { ...DEFAULT_SYNCED, ...((syncedResult[SYNC_SETTINGS_KEY] ?? {}) as Partial<SyncedSettings>) };
  const device = (localResult[DEVICE_SETTINGS_KEY] ?? {}) as { clientId?: string };
  return { ...synced, clientId: device.clientId ?? '' };
}

/** 保存设置：clientId 路由到本机存储，其余路由到账号同步存储 */
export async function saveSettings(partial: Partial<ExtensionSettings>): Promise<void> {
  const { clientId, ...rest } = partial;
  if (clientId !== undefined) {
    await chrome.storage.local.set({ [DEVICE_SETTINGS_KEY]: { clientId } });
  }
  if (Object.keys(rest).length > 0) {
    await writeSyncedSettings(rest);
  }
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

/** 首次安装生成 Client ID（UUID）；重装系统后可在设置页填回旧 ID 延续数据 */
export async function ensureClientId(): Promise<string> {
  const clientId = await readDeviceClientId();
  if (clientId) return clientId;
  const generated = crypto.randomUUID();
  await saveSettings({ clientId: generated });
  return generated;
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

export const SYNC_TOKEN_STORAGE_WARNING = 'Sync Token 保存在 chrome 存储中（账号同步范围），仅发送到你配置的服务器。';
