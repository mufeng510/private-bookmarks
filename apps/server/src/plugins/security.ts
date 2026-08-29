import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/**
 * 安全响应头 + robots.txt + CORS。
 * 网站全部页面禁止被搜索引擎索引；真正的安全来自服务器认证。
 */
export function registerSecurity(app: FastifyInstance, config: Config): void {
  app.addHook('onSend', async (request, reply, payload) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      reply.header(name, value);
    }
    const isHtml = (reply.getHeader('content-type') as string | undefined)?.includes('text/html');
    if (isHtml) {
      reply.header('Cache-Control', 'no-cache');
      reply.header(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          // favicon 来自 Google s2 服务，失败时页面回退显示默认图标
          "img-src 'self' https: data:",
          "style-src 'self'",
          "script-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          "object-src 'none'",
        ].join('; '),
      );
    }
    return payload;
  });

  app.get('/robots.txt', {
    logLevel: 'silent',
    async handler(_request, reply) {
      reply.type('text/plain; charset=utf-8');
      return 'User-agent: *\nDisallow: /\n';
    },
  });

  // CORS：只放行显式配置的来源（如 chrome-extension://<id>），绝不使用 *
  const allowedOrigins = new Set(config.allowedOrigins);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !request.url.startsWith('/api/')) return;
    if (!allowedOrigins.has(origin)) return;

    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      reply.header('Access-Control-Max-Age', '600');
      reply.code(204);
      return reply.send();
    }
  });
}
