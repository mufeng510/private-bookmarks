import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LoginPage from './pages/LoginPage.js';
import BookmarksPage from './pages/BookmarksPage.js';
import SettingsPage from './pages/SettingsPage.js';
import { AuthProvider, useAuth } from './auth';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: '/bookmarks',
    element: (
      <RequireAuth>
        <BookmarksPage />
      </RequireAuth>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireAuth>
        <SettingsPage />
      </RequireAuth>
    ),
  },
  {
    path: '*',
    element: (
      <RequireAuth>
        <BookmarksPage />
      </RequireAuth>
    ),
  },
]);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中…</div>;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中…</div>;
  if (user) return <Redirect to="/bookmarks" />;
  return <>{children}</>;
}

function Redirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <div className="page-loading">加载中…</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>,
);
