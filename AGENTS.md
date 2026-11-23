# Private Bookmarks · 项目约定

## 项目形态

pnpm workspace：`apps/server`（Fastify 5 + Drizzle + SQLite）、`apps/web`（React/Vite 管理端）、
`apps/extension`（Manifest V3 扩展）、`apps/website`（官网，部署在 Vercel）、
`packages/shared`、`packages/sync-protocol`。

## 开发与验证命令

在仓库根目录执行：

- 构建：`pnpm build`（必须先构建，否则 `packages/*` 的 dist 缺失，typecheck 会报找不到模块）
- 类型检查：`pnpm -r typecheck`
- 测试：`pnpm -r test`
- Lint：`pnpm -r lint`

改完服务端代码需跑通以上四项；`apps/website` 有 4 条既有的 unused-vars 警告，不属于新引入问题。

## 认证与安全约定

- 网站登录使用 HttpOnly Cookie Session（`pb_session`，签名）；扩展使用独立 Sync Token。二者不可互替。
- **Cookie 的 `Secure` 必须按实际请求协议判定**，统一走 `apps/server/src/lib/request-scheme.ts`
  的 `effectiveScheme()`，不要再改回用 `BASE_URL` 静态判断。原因与权衡见
  `docs/adr/0001-request-based-cookie-secure.md`。
- CSRF 同源校验（`auth/origin.ts`）与 Cookie 共用同一套协议判定。
- 日志禁止出现 Cookie、Token、密码、书签内容；Fastify logger 已 redact 相关字段，
  新增日志时不要绕过它。统一错误格式 `{ error: { code, message } }`。

## 部署

单容器 Docker + Compose；`BASE_URL` 仅作同源白名单兜底。公网反向代理需转发
`X-Forwarded-Proto: https`，这样同一部署可同时支持 https 域名与 http 局域网 IP 访问。
