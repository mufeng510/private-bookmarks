import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../i18n';

const CARD_COUNT = 6;

function FeatureCard({ icon, titleKey, descKey }: { icon: string; titleKey: string; descKey: string }) {
  const location = useLocation();
  const { t } = useLang(location.pathname);
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{t(titleKey as any)}</h3>
      <p className="feature-desc">{t(descKey as any)}</p>
    </div>
  );
}

export function Home() {
  const location = useLocation();
  const { lang, t } = useLang(location.pathname);
  const otherLang = lang === 'en' ? 'zh' : 'en';
  const otherPath = lang === 'en' ? '/zh/' : '/';

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">{t('heroBadge')}</div>
        <h1 className="hero-title">
          {t('heroTitle')} <span className="hero-title-emphasis">{t('heroTitleHighlight')}</span>
        </h1>
        <p className="hero-subtitle">{t('heroSubtitle')}</p>
        <div className="hero-actions">
          <a href="#how" className="btn btn-primary" onClick={() => {}}>
            {t('heroBtnGetStarted')}
          </a>
          <a
            href="https://github.com/jerry0510/private-bookmarks"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            {t('heroBtnGitHub')}
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features">
        <div className="section-header">
          <h2 className="section-title">{t('featuresTitle')}</h2>
        </div>
        <div className="feature-grid">
          <FeatureCard icon="↗" titleKey="featureOneWay" descKey="featureOneWayDesc" />
          <FeatureCard icon="🏠" titleKey="featureSelfHosted" descKey="featureSelfHostedDesc" />
          <FeatureCard icon="⚡" titleKey="featureManifestV3" descKey="featureManifestV3Desc" />
          <FeatureCard icon="🔑" titleKey="featureSyncToken" descKey="featureSyncTokenDesc" />
          <FeatureCard icon="🛡️" titleKey="featureMinimalPerms" descKey="featureMinimalPermsDesc" />
          <FeatureCard icon="📦" titleKey="footerGitHub" descKey="footerCommunity" />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="how">
        <div className="section-header">
          <h2 className="section-title">{t('howTitle')}</h2>
        </div>
        <div className="steps">
          <div className="step">
            <div className="step-number">01</div>
            <h3 className="step-title">{t('howStep1Title')}</h3>
            <p className="step-desc">{t('howStep1Desc')}</p>
          </div>
          <div className="step">
            <div className="step-number">02</div>
            <h3 className="step-title">{t('howStep2Title')}</h3>
            <p className="step-desc">{t('howStep2Desc')}</p>
          </div>
          <div className="step">
            <div className="step-number">03</div>
            <h3 className="step-title">{t('howStep3Title')}</h3>
            <p className="step-desc">{t('howStep3Desc')}</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2 className="cta-title">Ready to sync privately?</h2>
        <p className="cta-desc">Deploy your own Private Bookmarks server in minutes.</p>
        <div className="cta-actions">
          <a href="#how" className="btn btn-primary" onClick={() => {}}>
            {t('heroBtnGetStarted')}
          </a>
          <a
            href="https://github.com/jerry0510/private-bookmarks"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            {t('heroBtnGitHub')}
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq">
        <div className="section-header">
          <h2 className="section-title">Frequently asked questions</h2>
        </div>
        <div className="faq-grid">
          <details className="faq-item">
            <summary>Is my bookmark data sent to a third party?</summary>
            <p>No. The extension only sends bookmarks to the server URL you configure yourself. The project author and any third party never access your bookmarks.</p>
          </details>
          <details className="faq-item">
            <summary>Which browsers are supported?</summary>
            <p>Any Chromium-based browser with Manifest V3 support: Chrome, Edge, Brave, Vivaldi, etc.</p>
          </details>
          <details className="faq-item">
            <summary>Do I need a server?</summary>
            <p>Yes. You self-host the Private Bookmarks server (Docker Compose, SQLite) and point the extension at it.</p>
          </details>
          <details className="faq-item">
            <summary>Is it open source?</summary>
            <p>Yes, MIT licensed. Source: <a href="https://github.com/jerry0510/private-bookmarks" target="_blank" rel="noopener noreferrer">github.com/jerry0510/private-bookmarks</a>.</p>
          </details>
        </div>
      </section>
    </div>
  );
}
