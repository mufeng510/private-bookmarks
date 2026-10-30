import React from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '../i18n';

const sections: Record<string, { titleKey: string; contentKey: string }[]> = {
  en: [
    { titleKey: 'privacyWhoTitle', contentKey: 'privacyWho' },
    { titleKey: 'privacyCollectTitle', contentKey: 'privacyCollect' },
    { titleKey: 'privacyUseTitle', contentKey: 'privacyUse' },
    { titleKey: 'privacyPermsTitle', contentKey: 'privacyPermsTitle' },
    { titleKey: 'privacyShareTitle', contentKey: 'privacyShare' },
    { titleKey: 'privacyRightsTitle', contentKey: 'privacyRights' },
    { titleKey: 'privacyContactTitle', contentKey: 'privacyContact' },
  ],
  zh: [
    { titleKey: 'privacyWhoTitle', contentKey: 'privacyWho' },
    { titleKey: 'privacyCollectTitle', contentKey: 'privacyCollect' },
    { titleKey: 'privacyUseTitle', contentKey: 'privacyUse' },
    { titleKey: 'privacyPermsTitle', contentKey: 'privacyPermsTitle' },
    { titleKey: 'privacyShareTitle', contentKey: 'privacyShare' },
    { titleKey: 'privacyRightsTitle', contentKey: 'privacyRights' },
    { titleKey: 'privacyContactTitle', contentKey: 'privacyContact' },
  ],
};

export function Privacy() {
  const location = useLocation();
  const { lang, t } = useLang(location.pathname);
  const list = (sections[lang] ?? sections.en) as { titleKey: string; contentKey: string }[];

  const permItems: Record<string, string> = {
    en: {
      bookmarks: t('privacyPermBookmarks'),
      storage: t('privacyPermStorage'),
      alarms: t('privacyPermAlarms'),
      host: t('privacyPermHost'),
      note: t('privacyPermNote'),
    },
    zh: {
      bookmarks: t('privacyPermBookmarks'),
      storage: t('privacyPermStorage'),
      alarms: t('privacyPermAlarms'),
      host: t('privacyPermHost'),
      note: t('privacyPermNote'),
    },
  }[lang];

  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <h1>{t('privacyTitle')}</h1>
        <p className="privacy-date">{t('privacyEffective')}</p>
      </header>
      <div className="privacy-content">
        {list.map((s) => (
          <section key={s.titleKey} className="privacy-section">
            <h2>{t(s.titleKey as any)}</h2>
            <div className="privacy-body" dangerouslySetInnerHTML={{ __html: t(s.contentKey as any) }} />
          </section>
        ))}
        <section className="privacy-section">
          <h2>{t('privacyPermsTitle')}</h2>
          <ul className="privacy-list">
            <li>{permItems.bookmarks}</li>
            <li>{permItems.storage}</li>
            <li>{permItems.alarms}</li>
            <li>{permItems.host}</li>
          </ul>
          <p className="privacy-note">{permItems.note}</p>
        </section>
      </div>
    </div>
  );
}
