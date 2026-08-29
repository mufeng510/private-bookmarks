import React from 'react';
import { api, ApiError } from '../api.js';
import { useTheme } from '../auth.js';

export default function LoginPage() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [theme, setTheme] = useTheme();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(username.trim(), password);
      window.location.replace('/bookmarks');
    } catch (err) {
      setError(err instanceof ApiError ? '用户名或密码错误' : '登录失败，请稍后再试');
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="切换深色/浅色">
        {theme === 'dark' ? '☀️' : '🌙'}
      </div>
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-title">🔖 Private Bookmarks</h1>
        <p className="login-subtitle">私有书签同步系统</p>
        <input
          className="input"
          type="text"
          name="username"
          placeholder="用户名"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          name="password"
          placeholder="密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="login-error">⚠️ {error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>
      <p className="login-footer">仅限本人使用 · 数据保存在自己的 NAS 上</p>
    </div>
  );
}
