import React from 'react';
import type { BookmarksResponse, SearchResultItem } from '@private-bookmarks/shared';
import { api, ApiError, clientLabel } from '../api.js';
import { useAuth, useTheme } from '../auth.js';
import { BookmarkTree, buildTree, type TreeNode } from '../components/BookmarkTree.js';

type Tab = { kind: 'all' } | { kind: 'recent' } | { kind: 'folder'; remoteId: string; title: string };

export default function BookmarksPage() {
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useTheme();
  const [data, setData] = React.useState<BookmarksResponse | null>(null);
  const [client, setClient] = React.useState<string>('all');
  const [tab, setTab] = React.useState<Tab>({ kind: 'all' });
  const [query, setQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResultItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .bookmarks(client)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          return;
        }
        setError('加载书签失败，请稍后再试');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, setUser]);

  // 搜索防抖
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      api
        .search(q, client)
        .then((res) => setSearchResults(res.results))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, client]);

  const tree = React.useMemo(() => buildTree(data?.nodes ?? []), [data]);

  const roots = React.useMemo(
    () => tree.filter((item) => item.node.type === 'folder' && !item.orphan),
    [tree],
  );

  const recent = React.useMemo(() => {
    const bookmarks = (data?.nodes ?? [])
      .filter((n) => n.type === 'bookmark')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
    return bookmarks.map((node) => ({ node, children: [], orphan: false }) as TreeNode);
  }, [data]);

  const visibleTree: TreeNode[] = React.useMemo(() => {
    if (tab.kind === 'all') return tree;
    if (tab.kind === 'recent') return recent;
    return roots.filter((item) => item.node.remoteId === tab.remoteId);
  }, [tab, tree, recent, roots]);

  async function onLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      window.location.replace('/login');
    }
  }

  const searching = query.trim().length > 0;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-title">
          <span aria-hidden>🔖</span> My Bookmarks
        </div>
        <div className="topbar-actions">
          <button
            className="icon-btn"
            title="切换深色/浅色"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <a className="icon-btn" href="/settings" title="设置">
            ⚙️
          </a>
          <button className="icon-btn" onClick={onLogout} title="退出登录">
            🚪
          </button>
        </div>
      </header>

      <div className="container">
        <input
          className="input search-input"
          type="search"
          placeholder="🔍 搜索书签（标题 / URL / 文件夹）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="chips" role="tablist" aria-label="设备筛选">
          <button className={`chip ${client === 'all' ? 'chip-active' : ''}`} onClick={() => setClient('all')}>
            全部
          </button>
          {(data?.clients ?? []).map((c) => (
            <button
              key={c.clientId}
              className={`chip ${client === c.clientId ? 'chip-active' : ''}`}
              onClick={() => setClient(c.clientId)}
            >
              {clientLabel(c.clientId)}
            </button>
          ))}
        </div>

        {!searching && (
          <div className="chips" role="tablist" aria-label="文件夹分类">
            <button
              className={`chip ${tab.kind === 'all' ? 'chip-active' : ''}`}
              onClick={() => setTab({ kind: 'all' })}
            >
              全部
            </button>
            <button
              className={`chip ${tab.kind === 'recent' ? 'chip-active' : ''}`}
              onClick={() => setTab({ kind: 'recent' })}
            >
              最近
            </button>
            {roots.map((item) => (
              <button
                key={item.node.remoteId}
                className={`chip ${tab.kind === 'folder' && tab.remoteId === item.node.remoteId ? 'chip-active' : ''}`}
                onClick={() => setTab({ kind: 'folder', remoteId: item.node.remoteId, title: item.node.title })}
              >
                {item.node.title || '未命名'}
              </button>
            ))}
          </div>
        )}

        {error && <div className="error-hint">⚠️ {error}</div>}

        {searching ? (
          <SearchResultList results={searchResults} />
        ) : client === 'all' ? (
          <ClientGroups tree={visibleTree} />
        ) : loading ? (
          <div className="empty-hint">加载中…</div>
        ) : (
          <BookmarkTree items={visibleTree} />
        )}
      </div>

      <footer className="footer">
        {user?.username} · Private Bookmarks · 单向同步：浏览器 → 服务器
      </footer>
    </div>
  );
}

function ClientGroups({ tree }: { tree: TreeNode[] }) {
  const groups = React.useMemo(() => {
    const map = new Map<string, TreeNode[]>();
    for (const item of tree) {
      const list = map.get(item.node.clientId) ?? [];
      list.push(item);
      map.set(item.node.clientId, list);
    }
    return [...map.entries()];
  }, [tree]);

  return (
    <>
      {groups.map(([clientId, items]) => (
        <section key={clientId} className="client-group">
          <h2 className="client-group-title">{clientLabel(clientId)}</h2>
          <BookmarkTree items={items} />
        </section>
      ))}
    </>
  );
}

function SearchIcon({ result }: { result: SearchResultItem }) {
  const [failed, setFailed] = React.useState(false);
  if (result.type === 'folder') {
    return (
      <span className="bookmark-icon" aria-hidden>
        📁
      </span>
    );
  }
  if (failed || !result.faviconUrl) {
    return (
      <span className="bookmark-icon" aria-hidden>
        🌐
      </span>
    );
  }
  return (
    <img
      className="bookmark-icon bookmark-favicon"
      src={result.faviconUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function SearchResultList({ results }: { results: SearchResultItem[] | null }) {
  if (results === null) return <div className="empty-hint">搜索中…</div>;
  if (results.length === 0) return <div className="empty-hint">没有匹配的书签</div>;
  return (
    <div className="tree">
      {results.map((r) => (
        <div key={`${r.clientId}-${r.remoteId}`} className="bookmark-row">
          <SearchIcon result={r} />
          <a
            className="bookmark-link"
            href={r.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {r.title}
          </a>
          <span className="bookmark-url">
            {r.folderPath.length > 0 && `${r.folderPath.join(' / ')} · `}
            {r.url}
          </span>
        </div>
      ))}
    </div>
  );
}
