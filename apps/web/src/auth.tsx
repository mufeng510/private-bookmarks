import React from 'react';
import { api } from './api.js';

interface AuthState {
  user: { username: string } | null;
  loading: boolean;
  refresh(): Promise<void>;
  setUser(user: { username: string } | null): void;
}

const AuthContext = React.createContext<AuthState>({
  user: null,
  loading: true,
  refresh: async () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<{ username: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const session = await api.session();
      setUser({ username: session.username });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return <AuthContext.Provider value={{ user, loading, refresh, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return React.useContext(AuthContext);
}

/** 主题偏好：auto 跟随系统，手动选择持久化到 localStorage 与服务器偏好 */
export type ThemePref = 'auto' | 'light' | 'dark';

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.dataset['theme'] = pref;
  const dark =
    pref === 'dark' ||
    (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const [pref, setPref] = React.useState<ThemePref>(
    () => (localStorage.getItem('theme') as ThemePref | null) ?? 'auto',
  );
  React.useEffect(() => {
    applyTheme(pref);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(pref);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [pref]);

  const update = (t: ThemePref) => {
    localStorage.setItem('theme', t);
    setPref(t);
    void api.savePrefs({ theme: t }).catch(() => {});
  };
  return [pref, update];
}
