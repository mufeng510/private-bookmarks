import { getStatus, getSettings, saveSettings } from '../shared/storage.js';
import { statusSummary } from '../shared/sync-client.js';
import { countBookmarks } from '../shared/tree.js';

const dot = document.getElementById('status-dot') as HTMLSpanElement;
const statusText = document.getElementById('status-text') as HTMLSpanElement;
const countEl = document.getElementById('bookmark-count') as HTMLElement;
const lastSyncEl = document.getElementById('last-sync') as HTMLElement;
const statsEl = document.getElementById('last-stats') as HTMLElement;
const errorEl = document.getElementById('last-error') as HTMLElement;
const syncBtn = document.getElementById('sync-now') as HTMLButtonElement;
const autoSyncToggle = document.getElementById('auto-sync') as HTMLInputElement;
const openWebBtn = document.getElementById('open-web') as HTMLButtonElement;
const openOptionsBtn = document.getElementById('open-options') as HTMLButtonElement;

function setDot(kind: string): void {
  dot.className = 'dot';
  if (kind === 'connected') dot.classList.add('ok');
  else if (kind === 'not-configured' || kind === 'invalid-token' || kind === 'server-error' || kind === 'network-error') dot.classList.add('bad');
  else if (kind === 'rate-limited') dot.classList.add('warn');
  else if (kind === 'busy') dot.classList.add('busy');
}

async function refresh(): Promise<void> {
  const [summary, status, settings] = await Promise.all([statusSummary(), getStatus(), getSettings()]);
  setDot(summary.kind);
  statusText.textContent = summary.label;

  if (status.lastSyncAt) {
    const d = new Date(status.lastSyncAt);
    lastSyncEl.textContent = d.toLocaleString();
  } else {
    lastSyncEl.textContent = '从未';
  }

  if (status.lastStats && status.lastSyncStatus === 'success') {
    const s = status.lastStats;
    statsEl.textContent = `新增 ${s.created} · 更新 ${s.updated} · 删除 ${s.deleted} · 跳过 ${s.skipped}`;
    statsEl.classList.remove('hidden');
  } else {
    statsEl.classList.add('hidden');
  }

  if (status.lastError || (status.lastSyncStatus && status.lastSyncStatus !== 'success')) {
    const messages: Record<string, string> = {
      'invalid-token': 'Token 无效或已被撤销，请在设置页检查',
      'network-error': '无法连接服务器，请检查地址与网络',
      'server-error': '服务器错误，稍后自动重试（定时全量校验兜底）',
      'rate-limited': '请求过于频繁，请稍后再试',
    };
    errorEl.textContent = messages[status.lastSyncStatus ?? ''] ?? status.lastError ?? '';
    errorEl.classList.remove('hidden');
  } else {
    errorEl.classList.add('hidden');
  }

  autoSyncToggle.checked = settings.autoSyncPeriodMinutes > 0 && settings.eventSyncEnabled;
}

async function loadCount(): Promise<void> {
  const tree = await chrome.bookmarks.getTree();
  countEl.textContent = countBookmarks(tree).toLocaleString();
}

syncBtn.addEventListener('click', () => {
  syncBtn.disabled = true;
  syncBtn.textContent = '同步中…';
  setDot('busy');
  chrome.runtime.sendMessage({ type: 'sync-now', mode: 'incremental' }, () => {
    void chrome.runtime.lastError; // 忽略消息通道错误，状态以 storage 为准
    void refresh();
    syncBtn.disabled = false;
    syncBtn.textContent = '立即同步';
  });
});

autoSyncToggle.addEventListener('change', async () => {
  const enabled = autoSyncToggle.checked;
  await saveSettings({ eventSyncEnabled: enabled, autoSyncPeriodMinutes: enabled ? 360 : 0 });
});

openWebBtn.addEventListener('click', async () => {
  const settings = await getSettings();
  if (settings.serverUrl) chrome.tabs.create({ url: settings.serverUrl });
  else chrome.runtime.openOptionsPage();
});

openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

void refresh();
void loadCount();
