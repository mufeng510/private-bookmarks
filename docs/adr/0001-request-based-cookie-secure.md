# ADR 0001：Session Cookie 的 Secure 标记按请求协议判定

- 状态：已接受（2026-11-24）
- 相关代码：`apps/server/src/lib/request-scheme.ts`、`apps/server/src/auth/plugin.ts`、`apps/server/src/auth/origin.ts`
- 验证：`pnpm build`、`pnpm -r typecheck`、`pnpm -r test`（服务端 58 项全过）、`pnpm -r lint`；并用真实运行的服务器 + curl 复现两种访问方式。

## 背景

同一部署需要同时支持两种访问方式：公网 https 域名（经反向代理）和局域网 http IP 直连。
旧实现把 Cookie 的 `Secure` 静态绑定在 `BASE_URL` 上（`config.baseUrl.startsWith('https://')`）。
`.env.example` 默认填入 `BASE_URL=https://...`，导致局域网 http 访问时浏览器拒绝保存/发送
`pb_session`，表现为登录页无报错、控制台 `GET /api/auth/session` 返回 `401 AUTH_REQUIRED`，反复弹回登录页。

## 决策

新增 `effectiveScheme(request, config)`，按以下优先级判定"对外协议"，Cookie 的 `Secure`
与 CSRF 同源校验共用该结果：

1. 反向代理写入的 `X-Forwarded-Proto`（逗号分隔时取第一个有效值）；
2. 底层 socket 已加密；
3. 兼容未转发协议头的代理：`BASE_URL` 为 https 且请求 `Host` 与其一致；
4. 其余按 http。

`BASE_URL` 退化为同源白名单兜底，不再控制 `Secure`。

## 理由

- 一个部署同时兼容 https 域名与 http 局域网 IP，无需为局域网改配置。
- 协议判定集中在单一模块，Cookie 与同源校验不会不一致。
- 伪造 `X-Forwarded-Proto` 的最坏后果只是自己的 Cookie 标错 `Secure`（登录失效），
  不改变认证信任边界，故不强制依赖 `TRUST_PROXY`。

## 部署要求

公网反向代理需启用 HTTPS 并转发协议头，例如 Nginx：
`proxy_set_header X-Forwarded-Proto $scheme;`。未转发时由上述第 3 条兜底。

## 备选方案（已否决）

- 要求局域网用户把 `BASE_URL` 改成 http：需要为每个访问途径单独配置，易遗漏，且切换访问方式即失效。
- 仅用 `request.protocol`：Fastify 5 的 `request.protocol` 只看 `socket.encrypted`，
  不读 `X-Forwarded-Proto`，反向代理场景会误判为 http。
