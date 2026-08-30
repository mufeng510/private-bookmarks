import type { ApiError as ApiErrorBody, BookmarksResponse, SearchResponse } from '@private-bookmarks/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let code = 'SERVER_ERROR';
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body?.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // 非 JSON 错误体
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) {
    return (await res.blob()) as unknown as T;
  }
  return (await res.json()) as T;
}

export interface SessionInfo {
  username: string;
  version: string;
}

export const api = {
  session: () => request<SessionInfo>('/api/auth/session'),
  login: (username: string, password: string) =>
    request<SessionInfo>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => request<{ ok: boolean }>('/api/auth/logout-all', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  bookmarks: (client?: string) =>
    request<BookmarksResponse>(`/api/bookmarks${client && client !== 'all' ? `?client=${encodeURIComponent(client)}` : ''}`),
  search: (q: string, client?: string) => {
    const params = new URLSearchParams({ q });
    if (client && client !== 'all') params.set('client', client);
    return request<SearchResponse>(`/api/bookmarks/search?${params.toString()}`);
  },
  purgeDeleted: () => request<{ purged: number }>('/api/bookmarks/purge-deleted', { method: 'POST' }),

  syncStatus: () => request<SyncStatus>('/api/sync/status'),
  deleteClient: (clientId: string) =>
    request<{ ok: boolean; bookmarks: number }>(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' }),
  createToken: (name: string) =>
    request<TokenCreated>('/api/sync-tokens', { method: 'POST', body: JSON.stringify({ name }) }),
  listTokens: () => request<{ tokens: TokenInfo[] }>('/api/sync-tokens'),
  revokeToken: (id: string) => request<{ ok: boolean }>(`/api/sync-tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  settings: () => request<SettingsData>('/api/settings'),
  savePrefs: (prefs: Record<string, string>) =>
    request<{ ok: boolean }>('/api/settings', { method: 'POST', body: JSON.stringify({ prefs }) }),

  importPreview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ImportPreview>('/api/import/preview', { method: 'POST', body: form });
  },
  importConfirm: (roots: unknown[]) =>
    request<ImportResult>('/api/import', { method: 'POST', body: JSON.stringify({ roots }) }),
};

export interface SyncStatus {
  clients: Array<{
    clientId: string;
    lastSyncAt: string | null;
    lastFullSyncAt: string | null;
    syncVersion: number;
    bookmarkCount: number;
  }>;
  totalBookmarks: number;
  totalDeleted: number;
}

export interface TokenInfo {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface TokenCreated extends TokenInfo {
  token: string;
}

export interface SettingsData {
  username: string | null;
  createdAt: string | null;
  prefs: Record<string, string>;
  stats: { totalBookmarks: number; totalDeleted: number };
}

export interface ImportPreview {
  roots: unknown[];
  bookmarkCount: number;
  folderCount: number;
  skipped: number;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  skipped: number;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '从未';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '从未';
  return d.toLocaleString();
}

/** 显示用客户端名称：导入命名空间与设备 ID 的友好化 */
export function clientLabel(clientId: string): string {
  if (clientId === 'import') return '📥 导入的书签';
  return `💻 设备 ${clientId.slice(0, 8)}`;
}
