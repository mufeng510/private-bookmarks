# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---------- deps（完整依赖，含 dev，用于构建）----------
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/extension/package.json apps/extension/
COPY packages/shared/package.json packages/shared/
COPY packages/sync-protocol/package.json packages/sync-protocol/
RUN pnpm install --frozen-lockfile

# ---------- builder（构建 web 与 server）----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/web/ apps/web/
RUN pnpm --filter @private-bookmarks/shared build \
 && pnpm --filter @private-bookmarks/sync-protocol build \
 && pnpm --filter @private-bookmarks/server build \
 && pnpm --filter @private-bookmarks/web build

# ---------- prod-deps（仅服务器运行时依赖）----------
FROM base AS prod-deps
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/sync-protocol/package.json packages/sync-protocol/
RUN pnpm --filter @private-bookmarks/server deploy --prod --legacy /out

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="Private Bookmarks"
LABEL org.opencontainers.image.description="运行在个人 NAS 上的私有跨浏览器书签同步系统"
LABEL org.opencontainers.image.source="https://github.com/mufeng510/private-bookmarks"
LABEL org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_URL=/app/data/bookmarks.db \
    WEB_DIST=/app/web-dist

WORKDIR /app
COPY --from=prod-deps /out/node_modules /app/node_modules
COPY --from=prod-deps /out/package.json /app/package.json
COPY --from=builder /app/apps/server/dist /app/server/dist
COPY --from=builder /app/apps/server/drizzle /app/server/drizzle
COPY --from=builder /app/apps/server/package.json /app/server/package.json
COPY --from=builder /app/apps/web/dist /app/web-dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/data \
 && chown -R node:node /app

# 容器以 root 启动仅用于修正挂载卷属主，应用进程通过 entrypoint 降权为 node (uid 1000)
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
WORKDIR /app/server
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
