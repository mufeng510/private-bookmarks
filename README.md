# 🔖 Private Bookmarks

> 一个运行在个人 NAS 上的私有跨浏览器书签同步系统。

浏览器书签 **单向同步** 到你自己的服务器；任何浏览器 / 手机输入密码后即可查看全部书签。
数据 100% 归你所有，不依赖任何第三方云服务。

```text
Chrome
  ↓ 自动同步（扩展）
NAS（Docker）
  ↓ 🔐 密码
任意浏览器 / 手机
  ↓
查看自己的全部书签
```

## 核心特性

- **单向同步**：浏览器 → 服务器。服务器绝不反向修改浏览器书签（扩展代码中不存在任何 `chrome.bookmarks.create/remove/update` 调用），网站上的删除只影响服务器数据
- **私有安全**：网站必须密码登录；未登录调用任何 API 一律 `401`，拿不到任何书签数据
- **双通道认证**：网站用 HttpOnly Cookie Session（Argon2id 密码哈希）；浏览器扩展用独立 Sync Token（服务器只存 hash），两者完全分离
- **实时 + 定时**：书签事件防抖 2 秒批量上传；默认每 6 小时全量校验兜底（防休眠 / 事件丢失 / 网络中断）
- **完整还原层级**：文件夹树、排序、多设备分组展示，支持按设备筛选
- **服务器端搜索**：标题 / URL / 文件夹路径，5000+ 书签毫秒级返回
- **导入导出**：Chrome `bookmarks.html` 导入（预览 + 追加去重）、HTML / JSON 导出
- **软删除 + 手动清理**：同步异常不会造成书签永久丢失
- **自动备份**：SQLite 在线备份到 `data/backups/`，按天保留
- **单容器部署**：Web + API + SQLite 一个 Docker 镜像，支持 `linux/amd64` 与 `linux/arm64`（NAS 常见架构）

## 项目结构

```text
private-bookmarks/
├── apps/
│   ├── server/        # Fastify + Drizzle + SQLite 后端（含静态托管 Web）
│   ├── web/           # React + Vite 前端（登录 / 书签 / 设置）
│   └── extension/     # Chrome Manifest V3 扩展
├── packages/
│   ├── shared/        # 共享类型与常量（URL 白名单校验、错误码等）
│   └── sync-protocol/ # 扩展 ↔ 服务器同步协议类型
├── scripts/           # 发布脚本（一键发版 + Chrome Web Store 上传）
├── docker-compose.yml
├── Dockerfile         # multi-stage，非 root 运行，内置 healthcheck
└── .github/workflows/ # test / docker / release
```

## 技术栈

| 层 | 技术 |
|---|---|
| Server | Node.js 22 · TypeScript · Fastify 5 |
| Database | SQLite（better-sqlite3，WAL）· Drizzle ORM |
| Auth | Argon2id（@node-rs/argon2）· HttpOnly Cookie Session · Sync Token（SHA-256 存储） |
| Web | React 18 · Vite 6 · React Router · 手写轻量 CSS（移动端优先 / 深色模式） |
| Extension | Manifest V3 · Service Worker · `bookmarks` / `storage` / `alarms` 最小权限 |
| Deploy | Docker multi-stage · Docker Compose · GitHub Actions（Docker Hub + Chrome Web Store） |

## 快速开始（NAS / Docker 部署）

### 1. 准备文件

```bash
mkdir private-bookmarks && cd private-bookmarks

# 从仓库下载这两个文件
wget https://raw.githubusercontent.com/mufeng510/private-bookmarks/main/docker-compose.yml
wget https://raw.githubusercontent.com/mufeng510/private-bookmarks/main/.env.example

cp .env.example .env
```

### 2. 修改 `.env`

```env
# 必改：生成方法 openssl rand -base64 48
SESSION_SECRET=请替换为长随机字符串
# 必改：管理员初始密码
ADMIN_PASSWORD=请替换为强密码

# 建议修改
BASE_URL=https://bookmark.example.com   # 有域名/HTTPS 时填写；纯内网 http 可留空
ADMIN_USERNAME=admin
# Docker Hub 官方镜像（.env.example 已默认填好）
IMAGE=jerry0510/private-bookmarks:latest
PORT=8080
```

### 3. 启动

```bash
docker compose up -d
curl http://NAS-IP:8080/api/health
# {"status":"ok","version":"1.0.0","database":"ok"}
```

打开 `http://NAS-IP:8080` → 登录 → 进入「设置 → 同步」创建 Sync Token。

> 容器启动时入口脚本会自动把 `./data` 卷属主修正为容器内 node 用户（uid 1000），
> 随后应用进程以非 root 运行；无需手动 chown。
>
> 公网访问请务必在反向代理（Nginx / Caddy / 群晖套件等）上启用 HTTPS，
> 并把 `BASE_URL` 设为 https 地址，这样 Cookie 会自动带上 `Secure` 标记。

## Chrome 扩展安装与配置

### 安装（开发版 / Release zip）

1. 从 GitHub Releases 下载 `private-bookmarks-extension-vX.Y.Z.zip` 并解压
2. 打开 Chrome，访问 `chrome://extensions`
3. 右上角开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择解压后的目录

### 配置

1. 点击扩展图标 → 「设置」
2. 填写**服务器地址**（如 `https://bookmark.example.com` 或 `http://NAS-IP:8080`）
3. 填写**Sync Token**（网站设置页创建）
4. 点击「保存」→ 浏览器会请求访问你服务器地址的权限，选择「允许」
5. 点击「测试连接」确认 ✅，然后「立即全量同步」（或在 popup 点「立即同步」）

### Sync Token 获取

网站 → 设置 → 同步 → 「创建 Token」→ 输入名称 → **Token 只显示一次，立即保存**。
丢失或不安全时随时撤销重建（撤销后对应设备的扩展需重新配置）。

### 扩展行为说明

| 行为 | 说明 |
|---|---|
| 事件同步 | 新增 / 删除 / 修改 / 移动书签后，防抖 2 秒合并为一次批量上传 |
| 定时全量校验 | 默认每 6 小时（可配 1 / 6 / 12 / 24 小时或关闭），服务器对比后补齐漏同步 |
| 多设备 | 每台设备独立 Client ID，数据独立保存，Web 端可按设备筛选，绝不跨设备合并 |
| 自定义 Client ID | 扩展设置页可把随机 ID 改成好记的名字（如 `chrome-desktop`）。**重装系统 / 重装扩展后填回同一个 ID，同步数据就延续同一台"设备"** |
| 删除设备数据 | 网站「设置 → 同步」→ 对应设备「删除数据」，用于清理重装系统后的旧 ID 残留（不可恢复） |
| 权限 | 仅 `bookmarks` / `storage` / `alarms`；服务器访问权限为运行时按需申请 |
| 单向保证 | 扩展只调用 `chrome.bookmarks.getTree()` 与事件监听，绝不写入浏览器书签 |

### 重装系统 / 更换电脑怎么办？

1. 重装前：无需任何操作，数据都在自己 NAS 上
2. 重装后安装扩展，在设置页把 Client ID 填回原来的值（或任意自定义值），保存并全量同步
3. 若换了新 ID，旧的残留数据在网站「设置 → 同步」里点「删除数据」清理

## 数据备份

数据全部在挂载目录 `./data` 中：

```text
data/
├── bookmarks.db            # 主数据库（SQLite，WAL 模式）
├── bookmarks.db-shm/-wal
└── backups/                # 自动备份
    └── bookmarks-2026-08-29T12-00-00.db
```

- 容器内每天自动备份（`BACKUP_INTERVAL_HOURS=24`），保留 7 天（`BACKUP_RETENTION_DAYS=7`）
- 手动备份：直接复制 `bookmarks.db`，或先 `docker compose down` 再复制更保险
- 恢复：停容器 → 用备份文件覆盖 `bookmarks.db` → 启动
- 也可以用「设置 → 数据 → 导出」生成 HTML / JSON 快照作为第二保险

## 更新 / 升级 / 卸载

```bash
# 更新镜像并重启（数据在 ./data 卷中，不会丢失）
docker compose pull
docker compose up -d

# 卸载（保留数据）
docker compose down

# 卸载（彻底删除数据）⚠️ 不可恢复
docker compose down && rm -rf data .env
```

数据库结构变更通过内置迁移在启动时自动执行，跨版本升级无需手动操作。

## 安全说明

1. **未登录拿不到任何数据**：所有书签 API、搜索、导出均需 Session；未授权一律 `401`
2. **密码不落明文**：Argon2id 哈希；登录失败信息不区分「用户是否存在」
3. **Session**：HttpOnly + SameSite=Lax（HTTPS 下自动加 Secure），服务器只存 token hash，30 天过期，支持「退出所有设备」与修改密码后踢掉其他设备
4. **Sync Token**：与网站密码完全分离；服务器只存 SHA-256；创建时一次性展示；可随时撤销
5. **CSRF**：所有状态修改接口校验 Origin/Referer；Cookie SameSite=Lax
6. **XSS / URL 注入**：React 默认转义，无 `dangerouslySetInnerHTML`；同步与导入的 URL 仅接受 `http:` / `https:`，`javascript:` / `data:` 等一律拒绝
7. **限流**：登录 5 次 / 5 分钟（429）；同步接口按 Token 每分钟限流
8. **隐私**：全站 `noindex` + `robots.txt Disallow: /` + CSP；日志自动脱敏（Token / Cookie / 密码不落日志）
9. **没有** 多用户、分享、统计、抓取——这是一个单用户的私人工具

## Chrome Web Store 发布（维护者）

1. 在 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 注册开发者并创建扩展，获得 **Extension ID**
2. 创建 Google OAuth Client（Desktop 类型），生成 **Refresh Token**（scope `https://www.googleapis.com/auth/chromewebstore`）
3. 在仓库 Settings → Secrets 配置：

| Secret | 说明 |
|---|---|
| `CHROME_EXTENSION_ID` | 扩展 ID |
| `CHROME_CLIENT_ID` | OAuth Client ID |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret |
| `CHROME_REFRESH_TOKEN` | OAuth Refresh Token |

4. 发布：直接 `pnpm release 1.2.0`（见下方「版本发布」）。CI 自动：构建 → 校验 manifest → 打 zip → 创建 GitHub Release 并上传 → 上传 Chrome Web Store → 提交审核发布

> Chrome Web Store 审核由 Google 控制，提交后不会立即公开。

## GitHub Actions

| Workflow | 触发 | 作用 |
|---|---|---|
| `test.yml` | push / PR | lint → typecheck → test → build → 版本一致性检查 |
| `docker.yml` | push main / tag v* / PR / 手动 | Buildx 多架构构建（amd64 + arm64）并推送 Docker Hub `jerry0510/private-bookmarks`；main 推送 `latest` + `sha-` 标签，`v*` 标签额外推送 `1.0.0`、`1.0` 版本标签；PR 仅构建验证不推送 |
| `release.yml` | push tag v* | 版本一致性校验（tag = package.json = manifest.json）→ 全量构建 → 打包扩展 zip → 创建 GitHub Release 并上传 → Chrome Web Store 上传与提交发布（需配置 Secrets） |

## 版本发布（自动打 tag）

日常开发直接 push 到 main：CI 自动跑测试并发布 `latest` Docker 镜像，**不会**产生正式版本。

需要发布正式版本时，一条命令：

```bash
pnpm release 1.1.0     # 或 pnpm release --patch / --minor / --major
```

脚本会自动完成：更新所有 `package.json` 与扩展 `manifest.json` 的版本号 → 提交 `chore(release): v1.1.0` → 打标签 `v1.1.0` → 推送 GitHub。

之后的发布全部自动：

```text
tag v1.1.0 推送
  ├─ docker.yml  → Docker Hub 镜像 1.1.0 / 1.1 / latest
  └─ release.yml → GitHub Release v1.1.0（自动生成变更说明 + 扩展 zip）
                → Chrome Web Store 上传并提交审核（需已配置 CHROME_* Secrets）
```

> 说明：tag 必须由本地真实推送触发（`pnpm release` 用你的 git 凭证推送）。若由 CI 用内置
> GITHUB_TOKEN 创建 tag/Release，GitHub 不会触发其他 workflow（防递归），所以发布入口放在本地脚本。


## API 一览

```text
POST   /api/auth/login              # 登录（限流 5 次/5 分钟）
POST   /api/auth/logout             # 登出
POST   /api/auth/logout-all         # 退出所有设备
POST   /api/auth/change-password    # 修改密码
GET    /api/auth/session            # 当前会话

GET    /api/bookmarks               # 全量书签（?client= 设备筛选）
GET    /api/bookmarks/:id           # 单个书签
GET    /api/bookmarks/search?q=     # 服务端搜索（标题/URL/文件夹）
POST   /api/bookmarks/purge-deleted # 手动清理软删除书签

GET    /api/sync/status             # 各设备同步状态
GET    /api/sync/ping               # Token 连通性（Bearer）
POST   /api/sync                    # 同步（Bearer Sync Token，full / incremental）

GET    /api/settings                # 账户与偏好
POST   /api/settings                # 保存偏好（theme 等）
GET    /api/sync-tokens             # Token 列表
POST   /api/sync-tokens             # 创建 Token（明文仅返回一次）
DELETE /api/sync-tokens/:id         # 撤销 Token

POST   /api/import/preview          # 上传 HTML 解析预览
POST   /api/import                  # 确认导入（追加 + 去重）
GET    /api/export?format=html|json # 导出

GET    /api/health                  # 健康检查（公开）
GET    /robots.txt                  # 禁止索引（公开）
```

错误响应统一为：

```json
{ "error": { "code": "INVALID_SYNC_TOKEN", "message": "Sync token is invalid" } }
```

## 本地开发

```bash
pnpm install

pnpm --filter @private-bookmarks/shared build
pnpm --filter @private-bookmarks/sync-protocol build

pnpm dev:server        # http://localhost:8080（自动创建管理员，密码见日志）
pnpm dev:web           # http://localhost:5173（代理 /api 到 8080）
pnpm build:extension   # 扩展 dist/，Chrome 加载已解压扩展

pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

环境变量见 [.env.example](.env.example)。

## 已知限制（第一版）

- 单用户：只有一个管理员账户
- 多设备书签**不做合并**：每台浏览器是独立数据源（避免不同浏览器书签 ID 差异导致错乱）
- 网站端删除 / 编辑只影响服务器数据，不会回写浏览器（这是设计核心）
- favicon 使用 Google s2 服务域名生成、浏览器端加载，加载失败显示默认图标（不影响功能）
- Docker 镜像内的备份定时器随容器运行；宿主机层面的异地备份请自行用 cron 复制 `data/` 目录

## License

MIT
