import { ensureClientId, getSettings, normalizeServerUrl, saveSettings } from '../shared/storage.js';
import { testConnection } from '../shared/sync-client.js';

const serverUrlInput = document.getElementById('server-url') as HTMLInputElement;
const tokenInput = document.getElementById('sync-token') as HTMLInputElement;
const clientIdInput = document.getElementById('client-id') as HTMLInputElement;
const periodSelect = document.getElementById('sync-period') as HTMLSelectElement;
const eventSyncInput = document.getElementById('event-sync') as HTMLInputElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const testBtn = document.getElementById('test') as HTMLButtonElement;
const syncFullBtn = document.getElementById('sync-full') as HTMLButtonElement;
const msg = document.getElementById('msg') as HTMLDivElement;
const httpWarn = document.getElementById('http-warn') as HTMLParagraphElement;

function showMessage(kind: 'ok' | 'err', text: string): void {
  msg.className = `msg ${kind}`;
  msg.textContent = text;
}

function updateHttpWarning(): void {
  const url = normalizeServerUrl(serverUrlInput.value);
  const isHttp = url !== null && url.startsWith('http://');
  const isLocal = url !== null && /:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
  httpWarn.classList.toggle('hidden', !isHttp || isLocal);
}

serverUrlInput.addEventListener('input', updateHttpWarning);

/** 保存时向服务器来源申请可选 host 权限（Service Worker 跨域请求需要） */
async function requestHostPermission(serverUrl: string): Promise<boolean> {
  try {
    const origin = `${new URL(serverUrl).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [origin] });
    return granted === true;
  } catch {
    return false;
  }
}

saveBtn.addEventListener('click', () => {
  void (async () => {
    const serverUrl = normalizeServerUrl(serverUrlInput.value);
    const syncToken = tokenInput.value.trim();
    if (!serverUrl) {
      showMessage('err', '❌ 服务器地址无效（需要 http:// 或 https:// 开头）');
      return;
    }
    if (!syncToken) {
      showMessage('err', '❌ 请填写 Sync Token');
      return;
    }

    const granted = await requestHostPermission(serverUrl);
    await saveSettings({
      serverUrl,
      syncToken,
      autoSyncPeriodMinutes: Number(periodSelect.value),
      eventSyncEnabled: eventSyncInput.checked,
    });
    await ensureClientId();

    if (granted) {
      showMessage('ok', '✅ 已保存。书签变更将自动同步（首次请在 popup 中点击"立即同步"或等待定时全量）。');
    } else {
      showMessage('err', '⚠️ 已保存，但未授予访问服务器地址的权限，同步可能无法进行。');
    }
  })();
});

testBtn.addEventListener('click', () => {
  void (async () => {
    testBtn.disabled = true;
    // 先临时应用当前输入，便于"边填边测"
    const serverUrl = normalizeServerUrl(serverUrlInput.value);
    if (serverUrl) await saveSettings({ serverUrl, syncToken: tokenInput.value.trim() });
    const result = await testConnection();
    showMessage(result.ok ? 'ok' : 'err', result.message);
    testBtn.disabled = false;
  })();
});

syncFullBtn.addEventListener('click', () => {
  void (async () => {
    syncFullBtn.disabled = true;
    showMessage('ok', '⏳ 正在执行全量同步…');
    // 全量同步必须由后台 Service Worker 读取书签树构建完整 payload
    chrome.runtime.sendMessage({ type: 'sync-now', mode: 'full' }, (result) => {
      void chrome.runtime.lastError;
      if (result?.ok) {
        showMessage('ok', `✅ 全量同步完成：${result.message ?? ''}`);
      } else {
        showMessage('err', `❌ ${result?.message ?? '全量同步失败'}`);
      }
      syncFullBtn.disabled = false;
    });
  })();
});

void (async () => {
  const settings = await getSettings();
  serverUrlInput.value = settings.serverUrl;
  tokenInput.value = settings.syncToken;
  clientIdInput.value = settings.clientId || (await ensureClientId());
  periodSelect.value = String(settings.autoSyncPeriodMinutes);
  eventSyncInput.checked = settings.eventSyncEnabled;
  updateHttpWarning();
})();
