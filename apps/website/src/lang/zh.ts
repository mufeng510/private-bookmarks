export const zh = {
  // Nav
  navFeatures: '功能',
  navDocs: '文档',
  navGitHub: 'GitHub',
  navLanguageEn: 'English',
  navLanguageZh: '中文',
  navHow: '使用步骤',
  footerHow: '使用步骤',
  // Hero
  heroTitle: '你的浏览器书签，',
  heroTitleHighlight: '私有部署。',
  heroSubtitle:
    '将浏览器书签单向同步到你的私有 NAS 或自托管服务器。Manifest V3，无远程代码，服务器绝不反向修改书签。',
  heroBtnGetStarted: '开始使用',
  heroBtnGitHub: '查看 GitHub',
  heroBadge: '开源 · 私有部署 · MIT',
  // Features
  featuresTitle: '私有书签同步所需的一切。',
  featureOneWay: '单向同步',
  featureOneWayDesc:
    '仅读取本地书签并上传到你的服务器。服务器绝不会在浏览器中创建、删除或修改书签——浏览器始终是数据源。',
  featureSelfHosted: 'NAS 私有部署',
  featureSelfHostedDesc:
    '在自己的 NAS 或私有服务器上部署服务器。书签数据永不离开你的环境，也不会发送给任何第三方。',
  featureManifestV3: 'Manifest V3',
  featureManifestV3Desc:
    '现代扩展标准，无常驻后台 Service Worker，不执行远程代码——更安全、更轻量。',
  featureSyncToken: 'Sync Token 认证',
  featureSyncTokenDesc:
    '认证与网站登录密码完全分离。服务器仅存储 Token 的 SHA-256 哈希值。',
  featureMinimalPerms: '最小权限',
  featureMinimalPermsDesc:
    '仅请求 bookmarks、storage、alarms 权限，以及你自己的同步服务器域名的主机权限。',
  // How it works
  howTitle: '使用步骤',
  howStep1Title: '部署服务器',
  howStep1Desc:
    '通过 Docker Compose 在 NAS 上运行 Private Bookmarks 服务器。一条命令，持久化 SQLite 数据库。',
  howStep2Title: '安装扩展',
  howStep2Desc:
    '从 Chrome 网上应用店或 Edge 扩展商店安装 Private Bookmarks Sync 扩展，然后打开设置页。',
  howStep3Title: '连接并同步',
  howStep3Desc:
    '在设置页填入服务器地址和 Sync Token，书签将单向从浏览器同步到你的服务器。',
  // Footer
  footerProduct: '产品',
  footerFeatures: '功能',
  footerDocs: '文档',
  footerGitHub: 'GitHub',
  footerResources: '资源',
  footerInstall: '安装',
  footerConfig: '配置',
  footerSecurity: '安全',
  footerFAQ: '常见问题',
  footerCommunity: '社区',
  footerContributing: '参与贡献',
  footerCopyright: '© 2026 Private Bookmarks Sync',
  footerTagline: '开源书签同步。私有部署，MIT 协议。',
  // Privacy
  privacyTitle: '隐私政策',
  privacyEffective: '生效日期：2026 年 10 月',
  privacyWhoTitle: '1. 我们是谁',
  privacyWho:
    'Private Bookmarks 是一个运行在你个人 NAS / 私有服务器上的私有书签同步系统。浏览器扩展仅作为客户端，将你的浏览器书签单向同步到你自己部署的私有书签服务器。',
  privacyCollectTitle: '2. 我们收集什么数据',
  privacyCollect:
    '扩展仅读取你本地浏览器的书签数据（书签标题、URL、文件夹结构、添加/修改时间等），并通过 Sync Token 身份验证后，将这些数据上传到你自己配置的同步服务器地址。扩展不会收集你的浏览历史、Cookie、密码、表单数据或任何个人身份信息。',
  privacyUseTitle: '3. 数据如何使用与存储',
  privacyUse:
    '所有书签数据仅在你的本地浏览器和你自己的私有服务器之间传输。数据只存储在你自己的服务器上。Private Bookmarks 项目作者或任何第三方服务器不会接触、存储或访问你的书签内容。Sync Token 与你的网站登录密码完全分离，服务器仅存储其 SHA-256 哈希值。',
  privacyPermsTitle: '4. 权限说明',
  privacyPermBookmarks:
    'bookmarks：读取本地浏览器书签，用于同步到你的私有服务器。',
  privacyPermStorage:
    'storage：在本地缓存同步设置（服务器地址、客户端 ID、Sync Token 等）。',
  privacyPermAlarms:
    'alarms：定时触发后台自动同步。',
  privacyPermHost:
    'host permissions（http/https）：向你配置的同步服务器地址发送书签数据。',
  privacyPermNote:
    '扩展不执行任何远程代码（Manifest V3 不支持远程代码），不向除你配置的服务器外的任何第三方发送数据。',
  privacyShareTitle: '5. 数据共享与对外披露',
  privacyShare:
    '我们不会将你的书签数据出售、出租或共享给任何第三方。因为服务器由你自己部署和掌控，数据不会离开你的私有环境。',
  privacyRightsTitle: '6. 你的权利',
  privacyRights:
    '你可以随时在扩展设置页修改同步服务器地址、撤销或重新生成 Sync Token、退出所有设备，或卸载扩展以停止同步。卸载扩展后，你已同步到自己服务器的数据仍保留在你的服务器上，如需删除请在你自己的服务器上操作。',
  privacyContactTitle: '7. 联系我们',
  privacyContact:
    '如对本隐私政策或扩展有任何疑问，可通过 GitHub 项目仓库提交 Issue 联系我们：',
  privacyRepo: 'https://github.com/jerry0510/private-bookmarks',
};
