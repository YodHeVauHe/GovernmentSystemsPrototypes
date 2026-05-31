import type { RequestHandler } from 'express';

const sensitiveCachePathPrefixes = [
  '/api/auth',
  '/api/admin',
  '/api/access',
  '/api/docs',
  '/api/catalog',
  '/openapi',
];

export function securityHeadersForPath(path: string, tlsEnabled = false) {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  };

  if (tlsEnabled) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  if (sensitiveCachePathPrefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
    headers['Cache-Control'] = 'no-store';
    headers.Pragma = 'no-cache';
  }

  return headers;
}

export function securityHeadersMiddleware(resolveTlsEnabled: () => boolean): RequestHandler {
  return (req, res, next) => {
    const headers = securityHeadersForPath(req.path || req.originalUrl, resolveTlsEnabled());
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    next();
  };
}
