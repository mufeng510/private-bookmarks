export const en = {
  // Nav
  navFeatures: 'Features',
  navDocs: 'Docs',
  navGitHub: 'GitHub',
  navLanguageEn: 'English',
  navLanguageZh: '中文',
  navHow: 'How',
  footerHow: 'How it works',
  // Hero
  heroTitle: 'Your Browser Bookmarks,',
  heroTitleHighlight: 'Self-Hosted.',
  heroSubtitle:
    'One-way sync your browser bookmarks to your private NAS or self-hosted server. Manifest V3, no remote code, server never modifies your bookmarks back.',
  heroBtnGetStarted: 'Get Started',
  heroBtnGitHub: 'View on GitHub',
  heroBadge: 'Open Source · Self Hosted · MIT',
  // Features
  featuresTitle: 'Everything you need to sync bookmarks privately.',
  featureOneWay: 'One-way sync only',
  featureOneWayDesc:
    'Reads your local bookmarks and uploads them to your server. The server never creates, removes, or modifies bookmarks in your browser — your browser stays the source of truth.',
  featureSelfHosted: 'Self-hosted on your NAS',
  featureSelfHostedDesc:
    'Deploy the server on your own NAS or private server. Bookmark data never leaves your environment and is never sent to any third party.',
  featureManifestV3: 'Manifest V3',
  featureManifestV3Desc:
    'Modern extension standard with no persistent background service worker and no remote code execution — safer and lighter.',
  featureSyncToken: 'Sync Token auth',
  featureSyncTokenDesc:
    'Authentication is separate from your website login password. The server stores only the SHA-256 hash of the token.',
  featureMinimalPerms: 'Minimal permissions',
  featureMinimalPermsDesc:
    'Only requests bookmarks, storage, alarms, and host permission for your own sync server domain.',
  // How it works
  howTitle: 'How it works',
  howStep1Title: 'Deploy the server',
  howStep1Desc:
    'Run the Private Bookmarks server on your NAS via Docker Compose. One command, persistent SQLite database.',
  howStep2Title: 'Install the extension',
  howStep2Desc:
    'Install the Private Bookmarks Sync extension from the Chrome Web Store or Edge Add-ons, then open the settings page.',
  howStep3Title: 'Connect and sync',
  howStep3Desc:
    'Enter your server URL and Sync Token on the settings page. Bookmarks sync one-way from your browser to your server.',
  // Footer
  footerProduct: 'Product',
  footerFeatures: 'Features',
  footerDocs: 'Documentation',
  footerGitHub: 'GitHub',
  footerResources: 'Resources',
  footerInstall: 'Installation',
  footerConfig: 'Configuration',
  footerSecurity: 'Security',
  footerFAQ: 'FAQ',
  footerCommunity: 'Community',
  footerContributing: 'Contributing',
  footerCopyright: '© 2026 Private Bookmarks Sync',
  footerTagline: 'Open source bookmark sync. Self-hosted, MIT licensed.',
  // Privacy
  privacyTitle: 'Privacy Policy',
  privacyEffective: 'Effective date: October 2026',
  privacyWhoTitle: '1. Who we are',
  privacyWho:
    'Private Bookmarks is a private bookmark sync system running on your personal NAS / private server. The browser extension acts only as a client, one-way syncing your browser bookmarks to your self-hosted private bookmarks server.',
  privacyCollectTitle: '2. What data we collect',
  privacyCollect:
    'The extension only reads your local browser bookmarks (title, URL, folder structure, added/modified time, etc.), then uploads them after Sync Token authentication to your own configured sync server address. The extension does not collect your browsing history, cookies, passwords, form data, or any personally identifiable information.',
  privacyUseTitle: '3. How data is used and stored',
  privacyUse:
    'All bookmark data is transmitted only between your local browser and your own private server. Data is stored only on your own server. The Private Bookmarks project author or any third-party server will not access, store, or view your bookmark content. Sync Token is completely separate from your website login password; the server stores only its SHA-256 hash.',
  privacyPermsTitle: '4. Permissions',
  privacyPermBookmarks:
    'bookmarks — reads local browser bookmarks to sync them to your private server.',
  privacyPermStorage:
    'storage — caches sync settings locally (server address, client ID, Sync Token, etc.).',
  privacyPermAlarms:
    'alarms — triggers periodic background auto-sync.',
  privacyPermHost:
    'host permissions (http/https) — sends bookmark data to your configured sync server address.',
  privacyPermNote:
    'The extension executes no remote code (Manifest V3 does not support remote code) and sends data to no third party other than your configured server.',
  privacyShareTitle: '5. Data sharing and disclosure',
  privacyShare:
    'We do not sell, rent, or share your bookmark data with any third party. Because the server is deployed and controlled by you, the data never leaves your private environment.',
  privacyRightsTitle: '6. Your rights',
  privacyRights:
    'You may at any time modify the sync server address on the extension settings page, revoke or regenerate the Sync Token, sign out of all devices, or uninstall the extension to stop syncing. After uninstalling, bookmark data already synced to your own server remains on your server; delete it there if needed.',
  privacyContactTitle: '7. Contact us',
  privacyContact:
    'If you have any questions about this privacy policy or the extension, please submit an Issue via the GitHub repository:',
  privacyRepo: 'https://github.com/jerry0510/private-bookmarks',
};
