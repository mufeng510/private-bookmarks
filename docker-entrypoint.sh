#!/bin/sh
# 容器入口：仅当以 root 启动时，先修正数据目录属主，再降权为 node(uid 1000) 运行应用。
# 这样 NAS 用户直接挂载 ./data 卷即可，无需手动 chown。
set -e

if [ "$(id -u)" = "0" ]; then
  # 数据目录可能来自宿主机 bind mount，属主任意；修正为容器内 node 用户
  mkdir -p /app/data
  chown -R node:node /app/data 2>/dev/null || true

  if command -v gosu >/dev/null 2>&1; then
    exec gosu node "$@"
  elif command -v setpriv >/dev/null 2>&1; then
    # node:xx-slim 自带 util-linux 的 setpriv，无需额外安装 gosu
    exec setpriv --reuid=node --regid=node --init-groups "$@"
  else
    echo "[entrypoint] WARNING: gosu/setpriv 不可用，进程将以 root 运行" >&2
    exec "$@"
  fi
fi

# 已是非 root（例如 docker run --user 1000:1000），直接运行
exec "$@"
