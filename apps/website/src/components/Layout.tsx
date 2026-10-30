import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';

function langPaths(lang: string) {
  return lang === 'zh'
    ? { home: '/zh/', privacy: '/zh/privacy', other: '/', otherLabel: 'English' }
    : { home: '/', privacy: '/privacy', other: '/zh/', otherLabel: '中文' };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { lang, t } = useLang(location.pathname);
  const paths = langPaths(lang);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/zh/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="page">
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to={paths.home} className="navbar-brand" aria-label="Private Bookmarks">
            🔖{' '}
            <span className="brand-name">Private Bookmarks</span>
            <span className="brand-suffix">Sync</span>
          </Link>
          <div className="navbar-links">
            <Link
              to="#features"
              className={`navbar-link ${isActive('#features') ? 'active' : ''}`}
            >
              {t('navFeatures')}
            </Link>
            <Link
              to="#how"
              className={`navbar-link ${isActive('#how') ? 'active' : ''}`}
            >
              {t('navHow')}
            </Link>
            <a
              href="https://github.com/jerry0510/private-bookmarks"
              target="_blank"
              rel="noopener noreferrer"
              className="navbar-link navbar-github"
            >
              {t('navGitHub')} ↗
            </a>
            <button
              className="navbar-lang"
              onClick={() => {
                window.location.replace(paths.other);
              }}
              aria-label={`Switch to ${paths.otherLabel}`}
            >
              {paths.otherLabel}
            </button>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-col">
            <h4 className="footer-title">{t('footerProduct')}</h4>
            <ul className="footer-list">
              <li><a href="#features">{t('footerFeatures')}</a></li>
              <li><a href="#how">{t('footerHow')}</a></li>
              <li>
                <a href="https://github.com/jerry0510/private-bookmarks" target="_blank" rel="noopener noreferrer">
                  {t('footerGitHub')}
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-title">{t('footerResources')}</h4>
            <ul className="footer-list">
              <li><a href="#how">{t('footerInstall')}</a></li>
              <li><a href="#how">{t('footerConfig')}</a></li>
              <li><a href={paths.privacy}>{t('footerSecurity')}</a></li>
              <li><a href="#faq">{t('footerFAQ')}</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-title">{t('footerCommunity')}</h4>
            <ul className="footer-list">
              <li>
                <a href="https://github.com/jerry0510/private-bookmarks" target="_blank" rel="noopener noreferrer">
                  {t('footerContributing')}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">{t('footerCopyright')}</span>
          <span className="footer-tag">{t('footerTagline')}</span>
          <button className="footer-lang" onClick={() => { window.location.replace(paths.other); }}>
            {paths.otherLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}
