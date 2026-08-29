import type { SyncRequest, SyncResponse } from '@private-bookmarks/sync-protocol';
import { getSettings, getStatus, isConfigured, saveStatus, type ExtensionSettings } from './storage.js';

export type SyncOutcome = 'success' | 'invalid-token' | 'network-error' | 'server-error' | 'rate-limited';

export interface SyncRunResult {
  ok: boolean;
  outcome: SyncOutcome;
  message?: string;
}

/** 同步错误对应的用户可读文案（不包含 Token） */
function outcomeMessage(outcome: SyncOutcome, detail?: string): string {
  switch (outcome) {
    case 'invalid-token':
      return 'Sync Token 无效或已被撤销';
    case 'network-error':
      return '无法连接服务器';
    case 'rate-limited':
      return '请求过于频繁，请稍后再试';
    case 'server-error':
      return '服务器错误';
    default:
      return detail ?? '同步完成';
  }
}

async function request(path: string, settings: ExtensionSettings, init: RequestInit = {}): Promise<Response> {
  return fetch(`${settings.serverUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${settings.syncToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

/** 执行一次同步：mode=full 时服务器同时做全量校验（兜底防漏） */
export async function performSync(mode: 'full' | 'incremental', changes: SyncRequest['changes']): Promise<SyncRunResult> {
  const settings = await getSettings();
  if (!isConfigured(settings)) {
    return { ok: false, outcome: 'invalid-token', message: '尚未配置服务器地址或 Sync Token' };
  }

  try {
    const res = await request('/api/sync', settings, {
      method: 'POST',
      body: JSON.stringify({ clientId: settings.clientId, mode, changes } satisfies SyncRequest),
    });

    if (res.status === 401) {
      await saveStatus({ lastSyncAt: new Date().toISOString(), lastSyncMode: mode, lastSyncStatus: 'invalid-token', lastError: null });
      return { ok: false, outcome: 'invalid-token' };
    }
    if (res.status === 429) {
      await saveStatus({ lastSyncAt: new Date().toISOString(), lastSyncMode: mode, lastSyncStatus: 'rate-limited', lastError: null });
      return { ok: false, outcome: 'rate-limited' };
    }
    if (!res.ok) {
      await saveStatus({ lastSyncAt: new Date().toISOString(), lastSyncMode: mode, lastSyncStatus: 'server-error', lastError: `HTTP ${res.status}` });
      return { ok: false, outcome: 'server-error', message: `HTTP ${res.status}` };
    }

    const stats = (await res.json()) as SyncResponse;
    await saveStatus({
      lastSyncAt: new Date().toISOString(),
      lastSyncMode: mode,
      lastSyncStatus: 'success',
      lastError: null,
      lastStats: {
        created: stats.created,
        updated: stats.updated,
        deleted: stats.deleted,
        unchanged: stats.unchanged,
        skipped: stats.skipped,
      },
    });
    return { ok: true, outcome: 'success', message: `新增 ${stats.created} · 更新 ${stats.updated} · 删除 ${stats.deleted}` };
  } catch {
    await saveStatus({ lastSyncAt: new Date().toISOString(), lastSyncMode: mode, lastSyncStatus: 'network-error', lastError: null });
    return { ok: false, outcome: 'network-error' };
  }
}

/** 配置页"测试连接"：校验服务器可达 + Token 有效 */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const settings = await getSettings();
  if (!settings.serverUrl) return { ok: false, message: '请先填写服务器地址' };
  if (!settings.syncToken) return { ok: false, message: '请先填写 Sync Token' };

  try {
    const res = await request('/api/sync/ping', settings, { method: 'GET' });
    if (res.ok) return { ok: true, message: '✅ 连接成功，Token 有效' };
    if (res.status === 401) return { ok: false, message: '❌ Token 无效或已被撤销' };
    return { ok: false, message: `❌ 服务器返回 HTTP ${res.status}` };
  } catch {
    return { ok: false, message: '❌ 无法连接服务器，请检查地址与网络' };
  }
}

/** popup 显示的状态文案 */
export async function statusSummary(): Promise<{ kind: string; label: string }> {
  const settings = await getSettings();
  const status = await getStatus();
  if (!isConfigured(settings)) return { kind: 'not-configured', label: '未配置' };
  if (status.lastSyncStatus === null) return { kind: 'connected', label: '已连接（尚未同步）' };
  switch (status.lastSyncStatus) {
    case 'success':
      return { kind: 'connected', label: '已连接 · 同步成功' };
    case 'invalid-token':
      return { kind: 'invalid-token', label: 'Token 无效' };
    case 'network-error':
      return { kind: 'network-error', label: '服务器不可用' };
    case 'rate-limited':
      return { kind: 'rate-limited', label: '请求过于频繁' };
    case 'server-error':
      return { kind: 'server-error', label: '同步失败（服务器错误）' };
    default:
      return { kind: 'connected', label: '已连接' };
  }
}

export { outcomeMessage };
