import type { SyncChange } from '@private-bookmarks/sync-protocol';
import { DEVICE_SETTINGS_KEY, ensureClientId, getSettings, isConfigured, loadSnapshot, saveSnapshot, SYNC_SETTINGS_KEY } from '../shared/storage.js';
import { collectDateAdded, diffSnapshot, flattenTree, fullSyncChanges, type BrowserBookmarkNode } from '../shared/tree.js';
import { performSync, type SyncRunResult } from '../shared/sync-client.js';

/**
 * 后台 Service Worker。
 *
 * 核心原则（单向同步）：
 * 只读取 chrome.bookmarks 并上传服务器；
 * 绝不调用 chrome.bookmarks.create / remove / update / move —— 服务器数据的变化永远不影响浏览器。
 */

const INCREMENTAL_DEBOUNCE_MS = 2000;
const FULL_SYNC_ALARM = 'pb-full-sync';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let syncAgainAfter = false;

async function scheduleAlarm(): Promise<void> {
  const settings = await getSettings();
  if (settings.autoSyncPeriodMinutes > 0) {
    chrome.alarms.create(FULL_SYNC_ALARM, {
      periodInMinutes: settings.autoSyncPeriodMinutes,
      delayInMinutes: Math.min(settings.autoSyncPeriodMinutes, 15),
    });
  } else {
    await chrome.alarms.clear(FULL_SYNC_ALARM);
  }
}

/** 事件触发：防抖后做增量同步 */
function scheduleIncrementalSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync('incremental');
  }, INCREMENTAL_DEBOUNCE_MS);
}

async function readTree(): Promise<BrowserBookmarkNode[]> {
  return chrome.bookmarks.getTree();
}

/** 执行一次同步（串行化：进行中时合并为"完成后再次执行"） */
export async function runSync(mode: 'full' | 'incremental'): Promise<SyncRunResult> {
  if (syncing) {
    syncAgainAfter = true;
    return { ok: true, outcome: 'success', message: '已有同步在进行，稍后自动重试' };
  }
  syncing = true;
  try {
    const settings = await getSettings();
    await ensureClientId();
    if (!settings.serverUrl || !settings.syncToken) {
      return { ok: false, outcome: 'invalid-token', message: '尚未配置，请打开扩展设置页' };
    }

    const tree = await readTree();
    const current = flattenTree(tree);

    let changes: SyncChange[];
    if (mode === 'full') {
      changes = fullSyncChanges(current, collectDateAdded(tree));
    } else {
      const previous = await loadSnapshot();
      changes = diffSnapshot(previous, current);
    }

    const result = await performSync(mode, changes);
    if (result.ok) {
      await saveSnapshot(current);
    }
    return result;
  } finally {
    syncing = false;
    if (syncAgainAfter) {
      syncAgainAfter = false;
      setTimeout(() => void runSync(mode), 1500);
    }
  }
}

// ---- 书签事件（自上而下注册，Service Worker 唤醒后仍然生效）----
chrome.bookmarks.onCreated.addListener(() => scheduleIncrementalSync());
chrome.bookmarks.onRemoved.addListener(() => scheduleIncrementalSync());
chrome.bookmarks.onChanged.addListener(() => scheduleIncrementalSync());
chrome.bookmarks.onMoved.addListener(() => scheduleIncrementalSync());
chrome.bookmarks.onChildrenReordered.addListener(() => scheduleIncrementalSync());

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FULL_SYNC_ALARM) {
    void runSync('full');
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureClientId();
    await scheduleAlarm();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    await ensureClientId();
    await scheduleAlarm();
  })();
});

chrome.storage.onChanged.addListener((changes, area) => {
  // 设置变化（本机修改，或浏览器账号从其他设备同步下来）后重新调度定时全量同步
  const syncSettingsChanged = area === 'sync' && Boolean(changes[SYNC_SETTINGS_KEY]);
  const deviceChanged = area === 'local' && Boolean(changes[DEVICE_SETTINGS_KEY]);
  const legacyChanged = area === 'local' && Boolean(changes['settings']);
  if (syncSettingsChanged || deviceChanged || legacyChanged) {
    void scheduleAlarm();
  }
});

// popup / options 消息
chrome.runtime.onMessage.addListener((message: { type: string; mode?: 'full' | 'incremental' }, _sender, sendResponse) => {
  if (message.type === 'sync-now') {
    void (async () => {
      const settings = await getSettings();
      if (!isConfigured(settings)) {
        sendResponse({ ok: false, outcome: 'invalid-token', message: '尚未配置，请先打开设置页' });
        return;
      }
      const result = await runSync(message.mode ?? 'incremental');
      sendResponse(result);
    })();
    return true; // 异步响应
  }
  return false;
});
