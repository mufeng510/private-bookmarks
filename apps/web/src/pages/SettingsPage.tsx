import React from 'react';
import { api, ApiError, formatTime, clientLabel } from '../api.js';
import type { ImportPreview, ImportResult, SyncStatus, TokenCreated, TokenInfo } from '../api.js';
import { useAuth, useTheme } from '../auth.js';

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useTheme();

  async function onLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      window.location.replace('/login');
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-title">
          <a href="/bookmarks" className="icon-btn" title="返回书签">
            ←
          </a>
          <span aria-hidden>⚙️</span> 设置
        </div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            title="切换深色/浅色"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="icon-btn" onClick={onLogout} title="退出登录">
            🚪
          </button>
        </div>
      </header>

      <div className="container">
        <AccountSection />
        <SyncSection />
        <DataSection />
      </div>
      <footer className="footer">{user?.username} · Private Bookmarks</footer>
    </div>
  );
}

function AccountSection() {
  const { user, setUser } = useAuth();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: '新密码至少 8 位' });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: '两次输入的新密码不一致' });
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setMsg({ ok: true, text: '密码已修改，其他设备已全部退出' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' ? '当前密码不正确' : '修改失败' });
    } finally {
      setBusy(false);
    }
  }

  async function logoutAll() {
    if (!window.confirm('确定退出所有已登录设备吗？')) return;
    await api.logoutAll();
    setUser(null);
    window.location.replace('/login');
  }

  return (
    <section className="card">
      <h2 className="card-title">👤 账户</h2>
      <div className="kv-row">
        <span className="kv-key">用户名</span>
        <span>{user?.username}</span>
      </div>

      <form className="stack" onSubmit={submit}>
        <div className="card-subtitle">修改密码</div>
        <input
          className="input"
          type="password"
          placeholder="当前密码"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="新密码（至少 8 位）"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="确认新密码"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {msg && <div className={msg.ok ? 'ok-hint' : 'error-hint'}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}
        <div className="btn-row">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            保存新密码
          </button>
          <button className="btn btn-danger" type="button" onClick={logoutAll}>
            退出所有设备
          </button>
        </div>
      </form>
    </section>
  );
}

function SyncSection() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [tokens, setTokens] = React.useState<TokenInfo[]>([]);
  const [tokenName, setTokenName] = React.useState('');
  const [created, setCreated] = React.useState<TokenCreated | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api.syncStatus(), api.listTokens()]);
      setStatus(s);
      setTokens(t.tokens);
    } catch {
      setError('加载同步状态失败');
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function createToken() {
    setError(null);
    try {
      const token = await api.createToken(tokenName.trim() || '我的设备');
      setCreated(token);
      setTokenName('');
      await reload();
    } catch {
      setError('创建 Token 失败');
    }
  }

  async function revoke(id: string) {
    if (!window.confirm('确定撤销该 Token 吗？对应的浏览器扩展将无法继续同步。')) return;
    await api.revokeToken(id);
    await reload();
  }

  async function deleteClientData(clientId: string, count: number) {
    const ok = window.confirm(
      `确定删除设备「${clientLabel(clientId)}」的全部 ${count} 条书签数据吗？\n\n` +
        '此操作不可恢复。若该设备上的扩展仍在使用旧标识，下次同步会重新上传。\n' +
        '重装系统/更换设备标识后，可用它清理旧设备残留。',
    );
    if (!ok) return;
    try {
      const r = await api.deleteClient(clientId);
      setMsg({ ok: true, text: `已删除设备「${clientLabel(clientId)}」的数据 ${r.bookmarks} 条` });
      await reload();
    } catch {
      setMsg({ ok: false, text: '删除设备数据失败' });
    }
  }

  async function copyToken() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用时用户可手动复制
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">🔄 同步</h2>

      <div className="card-subtitle">设备与最后同步时间（重装系统后在扩展里填回同一 Client ID 即可延续数据）</div>
      {error && <div className="error-hint">⚠️ {error}</div>}
      {msg && <div className={msg.ok ? 'ok-hint' : 'error-hint'}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}
      {status && status.clients.length === 0 && <div className="empty-hint">还没有设备同步过，安装浏览器扩展后开始。</div>}
      {status?.clients.map((c) => (
        <div key={c.clientId} className="kv-row">
          <span className="kv-key">{clientLabel(c.clientId)}</span>
          <span className="kv-value">
            {c.bookmarkCount} 个书签 · 最后同步 {formatTime(c.lastSyncAt)}
            {c.lastFullSyncAt ? ` · 全量校验 ${formatTime(c.lastFullSyncAt)}` : ''}
            <button
              className="btn btn-small btn-danger"
              title="删除该设备的全部同步数据（不可恢复）"
              onClick={() => void deleteClientData(c.clientId, c.bookmarkCount)}
            >
              删除数据
            </button>
          </span>
        </div>
      ))}
      {status && (
        <div className="kv-row">
          <span className="kv-key">合计</span>
          <span className="kv-value">
            {status.totalBookmarks} 个书签{status.totalDeleted > 0 ? ` · ${status.totalDeleted} 个已删除（可在下方清理）` : ''}
          </span>
        </div>
      )}

      <div className="card-subtitle">Sync Token（用于浏览器扩展登录，与网站密码分离）</div>
      {error && <div className="error-hint">⚠️ {error}</div>}
      <div className="token-list">
        {tokens.length === 0 && <div className="empty-hint">还没有 Token，创建一个给扩展使用。</div>}
        {tokens.map((t) => (
          <div key={t.id} className="kv-row token-row">
            <span className="kv-key">
              {t.name} <code className="token-prefix">{t.prefix}…</code>
            </span>
            <span className="kv-value">
              创建于 {formatTime(t.createdAt)}
              {t.lastUsedAt ? ` · 最后使用 ${formatTime(t.lastUsedAt)}` : ' · 从未使用'}
              <button className="btn btn-small btn-danger" onClick={() => void revoke(t.id)}>
                撤销
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="btn-row">
        <input
          className="input input-inline"
          type="text"
          placeholder="Token 名称（如：Chrome 台式机）"
          value={tokenName}
          maxLength={64}
          onChange={(e) => setTokenName(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => void createToken()}>
          创建 Token
        </button>
      </div>

      {created && (
        <div className="token-created">
          <p>
            <strong>⚠️ Token 只显示这一次，请立即复制并保存：</strong>
          </p>
          <code className="token-value">{created.token}</code>
          <div className="btn-row">
            <button className="btn btn-small" onClick={() => void copyToken()}>
              {copied ? '✅ 已复制' : '复制'}
            </button>
            <button className="btn btn-small" onClick={() => setCreated(null)}>
              我已保存
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DataSection() {
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const p = await api.importPreview(file);
      setPreview(p);
    } catch {
      setMsg({ ok: false, text: '解析文件失败，请确认是 Chrome 导出的 bookmarks.html' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await api.importConfirm(preview.roots);
      setResult(r);
      setPreview(null);
    } catch {
      setMsg({ ok: false, text: '导入失败' });
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    if (!window.confirm('确定永久删除所有"已删除"的书签吗？此操作不可恢复。')) return;
    try {
      const r = await api.purgeDeleted();
      setMsg({ ok: true, text: `已永久清理 ${r.purged} 条` });
    } catch {
      setMsg({ ok: false, text: '清理失败' });
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">📦 数据</h2>

      <div className="card-subtitle">导入 Chrome 书签（bookmarks.html，追加 + 去重，不影响已同步数据）</div>
      <input ref={fileRef} type="file" accept=".html,text/html" onChange={(e) => void onFilePicked(e)} disabled={busy} />
      {preview && (
        <div className="preview-box">
          <p>
            共解析出 <strong>{preview.folderCount}</strong> 个文件夹、<strong>{preview.bookmarkCount}</strong> 个书签
            {preview.skipped > 0 ? `，${preview.skipped} 条无效 URL 将被跳过` : ''}。
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => void confirmImport()} disabled={busy}>
              确认导入
            </button>
            <button className="btn" onClick={() => setPreview(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="ok-hint">
          ✅ 导入完成：新增 {result.created}，更新 {result.updated}，跳过重复 {result.skipped}
        </div>
      )}

      <div className="card-subtitle">导出</div>
      <div className="btn-row">
        <a className="btn" href="/api/export?format=html" download>
          导出 bookmarks.html
        </a>
        <a className="btn" href="/api/export?format=json" download>
          导出 JSON
        </a>
      </div>

      <div className="card-subtitle">维护</div>
      {msg && <div className={msg.ok ? 'ok-hint' : 'error-hint'}>{msg.ok ? '✅' : '⚠️'} {msg.text}</div>}
      <button className="btn btn-danger" onClick={() => void purge()}>
        清理已删除书签
      </button>
    </section>
  );
}
