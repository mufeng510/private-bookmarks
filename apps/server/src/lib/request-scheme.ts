import type { FastifyRequest } from 'fastify';
import type { Config } from '../config.js';

export type RequestScheme = 'http' | 'https';

function forwardedProto(request: FastifyRequest): RequestScheme | undefined {
  const header = request.headers['x-forwarded-proto'];
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return undefined;
  const first = value.split(',')[0]?.trim().toLowerCase();
  return first === 'http' || first === 'https' ? first : undefined;
}

/**
 * 判定请求的「对外协议」——Cookie 的 Secure 标记与同源校验都应以它为准，
 * 而不是静态的 BASE_URL（同一部署可能同时用 https 域名和 http 局域网 IP 访问）。
 *
 * 优先级：
 * 1. 反向代理写入的 X-Forwarded-Proto（取逗号分隔的第一个有效值）；
 * 2. 底层 socket 已加密（直连 TLS / 注入测试的 https 场景）；
 * 3. 兼容未转发协议的代理：BASE_URL 为 https 且请求 Host 与其一致；
 * 4. 其余按 http。
 *
 * 仅用于决定 Cookie 属性与同源白名单，不改变认证信任边界。
 * 客户端伪造 X-Forwarded-Proto 的最坏结果只是自己的 Cookie 标错 Secure，无法越权。
 */
export function effectiveScheme(request: FastifyRequest, config: Config): RequestScheme {
  const proto = forwardedProto(request);
  if (proto) return proto;

  const encrypted = (request.raw.socket as unknown as { encrypted?: boolean } | undefined)?.encrypted === true;
  if (encrypted) return 'https';

  if (config.baseUrl.startsWith('https://')) {
    try {
      const base = new URL(config.baseUrl);
      const host = (request.headers.host ?? '').toLowerCase();
      if (host === base.host.toLowerCase() || host === base.hostname.toLowerCase()) {
        return 'https';
      }
    } catch {
      // baseUrl 配置非法时忽略，按 http 处理
    }
  }

  return 'http';
}

export function isSecureRequest(request: FastifyRequest, config: Config): boolean {
  return effectiveScheme(request, config) === 'https';
}
