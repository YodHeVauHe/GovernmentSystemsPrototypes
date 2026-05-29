import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { buildRegisteredSandboxMappings, computeApiKeyAccess, computeApiKeyHash, getApiKeyPreview, resolveSandboxApiId, type SandboxApiMapping } from '../admin';
import { logAuditEvent } from '../audit';
import { consumeRateLimit } from '../rate-limit';
import type { Db } from '../db';
import { many, one } from '../db';

async function getDynamicSandboxMappings(db: Db): Promise<SandboxApiMapping[]> {
  const rows = await many(db, 'SELECT id, sandbox_available FROM apis WHERE sandbox_available = TRUE');
  return buildRegisteredSandboxMappings(rows);
}

async function getApiIdFromPath(db: Db, url: string): Promise<string | null> {
  return resolveSandboxApiId(url) || resolveSandboxApiId(url, await getDynamicSandboxMappings(db));
}

const SANDBOX_RATE_LIMIT = Number(process.env.GOVHUB_SANDBOX_RATE_LIMIT || 100);
const INVALID_SANDBOX_RATE_LIMIT = Number(process.env.GOVHUB_INVALID_SANDBOX_RATE_LIMIT || 30);
const SANDBOX_RATE_WINDOW_MS = 60 * 1000;

const sensitiveLogKeys = new Set(['nin', 'tin', 'password', 'token', 'api_key', 'x-govhub-api-key', 'authorization', 'cookie']);

export function redactSandboxLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => redactSandboxLogValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'nin' && typeof nestedValue === 'string') {
      return [key, nestedValue.replace(/^(.{4}).*(.{2})$/, '$1******$2')];
    }
    if (normalizedKey === 'tin' && typeof nestedValue === 'string') {
      return [key, nestedValue.replace(/^(.{2}).*(.{2})$/, '$1****$2')];
    }
    if (sensitiveLogKeys.has(normalizedKey)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSandboxLogValue(nestedValue)];
  }));
}

export function normalizeSandboxLogPath(pathWithQuery: string) {
  const [pathname, query = ''] = pathWithQuery.split('?');
  const redactedPathname = pathname
    .replace(/^\/api\/v1\/identity\/status\/[^/?#]+/, '/api/v1/identity/status/[REDACTED]')
    .replace(/^\/api\/v1\/tax\/clearance\/[^/?#]+/, '/api/v1/tax/clearance/[REDACTED]')
    .replace(/^\/api\/v1\/business\/registration\/[^/?#]+/, '/api/v1/business/registration/[REDACTED]')
    .replace(/^\/api\/v1\/transport\/driving-permit\/status\/[^/?#]+/, '/api/v1/transport/driving-permit/status/[REDACTED]');
  if (!query) return redactedPathname;
  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    if (sensitiveLogKeys.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
    }
  }
  const nextQuery = params.toString();
  return nextQuery ? `${redactedPathname}?${nextQuery}` : redactedPathname;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sandboxMiddleware(db: Db) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Always generate a server-side Correlation ID — never trust client input for audit logs
    const correlationId = crypto.randomUUID();
    res.setHeader('X-Correlation-ID', correlationId);

    // Echo the client's ID as X-Request-ID only if it is a valid UUID (no injection risk)
    const clientRequestId = req.headers['x-correlation-id'];
    if (typeof clientRequestId === 'string' && UUID_RE.test(clientRequestId)) {
      res.setHeader('X-Request-ID', clientRequestId);
    }

    // Mask sensitive values in logs (simple mock logger)
    const maskedBody = redactSandboxLogValue(req.body || {});

    console.log(`[SANDBOX] ${req.method} ${normalizeSandboxLogPath(req.originalUrl)} | ID: ${correlationId} | Body:`, maskedBody);
    const auditPath = normalizeSandboxLogPath(req.originalUrl);

    // Enforce API Key
    const apiKey = req.headers['x-govhub-api-key'] as string;
    const apiId = await getApiIdFromPath(db, req.originalUrl);
    res.locals.sandboxApiId = apiId;

    if (!apiKey) {
      await logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
        reason: 'The X-GovHub-API-Key header is missing.',
        path: auditPath,
        method: req.method
      });
      return sendSandboxError(res, 'MISSING_API_KEY', 'The X-GovHub-API-Key header is missing.', 401);
    }

    const apiKeyHash = computeApiKeyHash(apiKey);
    const requestRecord = await one(db, `
      SELECT
        r.consumer_mda_id,
        r.consumer_user_id,
        u.status as consumer_user_status,
        r.api_id,
        r.status,
        r.api_key_status,
        r.api_key_expires_at,
        r.api_key_revoked_at
      FROM access_requests r
      LEFT JOIN users u ON u.id = r.consumer_user_id
      WHERE r.api_key_hash = $1
    `, [apiKeyHash]);
    const accessDecision = computeApiKeyAccess(requestRecord, apiId);
    if (!requestRecord) {
      const invalidQuota = await consumeRateLimit(db, 'sandbox_invalid', req.ip || req.socket.remoteAddress || 'unknown', INVALID_SANDBOX_RATE_LIMIT, SANDBOX_RATE_WINDOW_MS);
      res.setHeader('X-RateLimit-Limit', String(INVALID_SANDBOX_RATE_LIMIT));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, invalidQuota.remaining)));
      res.setHeader('X-RateLimit-Reset', Math.floor(invalidQuota.resetAt / 1000));
      if (!invalidQuota.allowed) {
        return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'Too many invalid sandbox API key attempts.', 429);
      }
    } else {
      const quota = await consumeRateLimit(db, 'sandbox', apiKeyHash, SANDBOX_RATE_LIMIT, SANDBOX_RATE_WINDOW_MS);
      res.setHeader('X-RateLimit-Limit', String(SANDBOX_RATE_LIMIT));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, quota.remaining)));
      res.setHeader('X-RateLimit-Reset', Math.floor(quota.resetAt / 1000));
      if (!quota.allowed) {
        return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'The sandbox rate limit for this API key has been exceeded.', 429);
      }
    }
    if (accessDecision.allowed === false && accessDecision.code !== 'UNAUTHORIZED_ENDPOINT') {
      await logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
        reason: accessDecision.message,
        path: auditPath,
        method: req.method,
        provided_key: getApiKeyPreview(apiKey)
      });
      return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
    }

    // Enforce endpoint/scope verification
    if (accessDecision.allowed === false && accessDecision.code === 'UNAUTHORIZED_ENDPOINT') {
      await logAuditEvent(db, 'SANDBOX_CALL_DENIED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
        consumer_user_id: requestRecord.consumer_user_id,
        reason: accessDecision.message,
        path: auditPath,
        method: req.method,
        authorized_api: requestRecord.api_id
      });
      return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
    }

    // Key is valid and authorized
    await logAuditEvent(db, 'SANDBOX_CALL_ALLOWED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
      consumer_user_id: requestRecord.consumer_user_id,
      path: auditPath,
      method: req.method
    });

    next();
  };
}

export function sendSandboxError(res: Response, code: string, message: string, status: number = 400) {
  const correlationId = res.getHeader('X-Correlation-ID') || crypto.randomUUID();
  res.status(status).json({
    error: {
      requestId: correlationId,
      code,
      message,
      source: 'GovHub Sandbox',
      timestamp: new Date().toISOString()
    }
  });
}
