import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="shell">
      <div className="topbar">
        <div className="topbar-title">🔖 Private Bookmarks</div>
        <div className="topbar-actions" />
      </div>
      <div className="container">
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '24px 0 8px' }}>
          隐私政策 / Privacy Policy
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
          生效日期 / Effective date：2026 年 10 月 / October 2026
        </p>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            1. 我们是谁 / Who we are
          </h2>
          <p style={{ color: '#1c1e21' }}>
            Private Bookmarks 是一个运行在你个人 NAS / 私有服务器上的私有书签同步系统。<br />
            浏览器扩展仅作为客户端，将你的浏览器书签单向同步到你自己部署的私有书签服务器。
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            <b>Private Bookmarks</b> is a private bookmark sync system running on your personal NAS / private server.{' '}
            The browser extension acts only as a client, one-way syncing your browser bookmarks to your self-hosted private bookmarks server.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            2. 我们收集什么数据 / What data we collect
          </h2>
          <p style={{ color: '#1c1e21' }}>
            扩展仅读取你本地浏览器的书签数据（书签标题、URL、文件夹结构、添加/修改时间等），<br />
            并通过 <b>Sync Token</b> 身份验证后，将这些数据上传到<b>你自己配置</b>的同步服务器地址。<br />
            扩展不会收集你的浏览历史、Cookie、密码、表单数据或任何个人身份信息。
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            The extension only reads your local browser bookmarks (title, URL, folder structure, added/modified time, etc.),{' '}
            then uploads them after <b>Sync Token</b> authentication to <b>your own configured</b> sync server address.{' '}
            The extension does not collect your browsing history, cookies, passwords, form data, or any personally identifiable information.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            3. 数据如何使用与存储 / How data is used and stored
          </h2>
          <p style={{ color: '#1c1e21' }}>
            所有书签数据仅在你的本地浏览器和你自己的私有服务器之间传输。<br />
            <b>数据只存储在你自己的服务器上，</b>Private Bookmarks 项目作者或任何第三方服务器<b>不会</b>接触、存储或访问你的书签内容。<br />
            Sync Token 与你的网站登录密码完全分离，服务器仅存储其 SHA-256 哈希值。
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            All bookmark data is transmitted only between your local browser and your own private server.{' '}
            <b>Data is stored only on your own server.</b> The Private Bookmarks project author or any third-party server{' '}
            <b>will not</b> access, store, or view your bookmark content. Sync Token is completely separate from your website login password;{' '}
            the server stores only its SHA-256 hash.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            4. 权限说明 / Permissions
          </h2>
          <ul style={{ color: '#1c1e21', paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>
              <b>bookmarks</b>：读取本地浏览器书签，用于同步到你的私有服务器。/
              Reads local browser bookmarks to sync them to your private server.
            </li>
            <li>
              <b>storage</b>：在本地缓存同步设置（服务器地址、客户端 ID、Sync Token 等）。/
              Caches sync settings locally (server address, client ID, Sync Token, etc.).
            </li>
            <li>
              <b>alarms</b>：定时触发后台自动同步。/
              Triggers periodic background auto-sync.
            </li>
            <li>
              <b>host permissions（http/https）</b>：向你配置的同步服务器地址发送书签数据。/
              Sends bookmark data to your configured sync server address.
            </li>
          </ul>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '10px' }}>
            扩展不执行任何远程代码（Manifest V3 不支持远程代码），不向除你配置的服务器外的任何第三方发送数据。<br />
            The extension executes no remote code (Manifest V3 does not support remote code) and sends data to no third party other than your configured server.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            5. 数据共享与对外披露 / Data sharing and disclosure
          </h2>
          <p style={{ color: '#1c1e21' }}>
            我们不会将你的书签数据出售、出租或共享给任何第三方。因为服务器由你自己部署和掌控，<br />
            数据不会离开你的私有环境。
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            We do not sell, rent, or share your bookmark data with any third party. Because the server is deployed and controlled by you,{' '}
            the data never leaves your private environment.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            6. 你的权利 / Your rights
          </h2>
          <p style={{ color: '#1c1e21' }}>
            你可以随时在扩展设置页修改同步服务器地址、撤销或重新生成 Sync Token、退出所有设备，<br />
            或卸载扩展以停止同步。卸载扩展后，你已同步到自己服务器的数据仍保留在你的服务器上，<br />
            如需删除请在你自己的服务器上操作。
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            You may at any time modify the sync server address on the extension settings page, revoke or regenerate the Sync Token, sign out of all devices,{' '}
            or uninstall the extension to stop syncing. After uninstalling, bookmark data already synced to your own server remains on your server;{' '}
            delete it there if needed.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title" style={{ fontSize: '18px' }}>
            7. 联系我们 / Contact us
          </h2>
          <p style={{ color: '#1c1e21' }}>
            如对本隐私政策或扩展有任何疑问，可通过 GitHub 项目仓库提交 Issue 联系我们：
          </p>
          <p style={{ color: '#2f6fed', wordBreak: 'break-all' }}>
            https://github.com/jerry0510/private-bookmarks
          </p>
          <p style={{ color: '#1c1e21', marginTop: '8px' }}>
            If you have any questions about this privacy policy or the extension, please submit an Issue via the GitHub repository:
          </p>
          <p style={{ color: '#2f6fed', wordBreak: 'break-all' }}>
            https://github.com/jerry0510/private-bookmarks
          </p>
        </div>

        <div className="footer">
          Private Bookmarks · 私有书签同步系统
        </div>
      </div>
    </div>
  );
}
