import type { RequestHandler } from 'express';
import { SESSION_COOKIE_NAME } from './auth';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function hasSessionCookie(cookieHeader: string) {
  return cookieHeader
    .split(';')
    .some(cookie => cookie.trim().split('=')[0] === SESSION_COOKIE_NAME);
}

export function isCookieAuthenticatedMutationAllowed(
  method: string,
  cookieHeader: string | undefined,
  origin: string | undefined,
  allowedOrigins: string[],
) {
  if (safeMethods.has(method.toUpperCase())) return true;
  if (!hasSessionCookie(cookieHeader || '')) return true;
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function cookieCsrfProtectionMiddleware(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    if (isCookieAuthenticatedMutationAllowed(req.method, req.headers.cookie, origin, allowedOrigins)) {
      return next();
    }

    return res.status(403).json({
      error: 'Origin is required for cookie-authenticated state-changing requests.',
      code: 'CSRF_ORIGIN_REQUIRED',
    });
  };
}
