import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { buildRegisteredSandboxMappings, computeApiKeyAccess, computeApiKeyHash, getApiKeyPreview, resolveSandboxApiId, type SandboxApiMapping } from '../admin';
import { logAuditEvent } from '../audit';

function getDynamicSandboxMappings(db: Database.Database): SandboxApiMapping[] {
  const rows = db.prepare('SELECT id, sandbox_available FROM apis WHERE sandbox_available = 1').all() as any[];
  return buildRegisteredSandboxMappings(rows);
}

function getApiIdFromPath(db: Database.Database, url: string): string | null {
  return resolveSandboxApiId(url) || resolveSandboxApiId(url, getDynamicSandboxMappings(db));
}

const sandboxRateLimits = new Map<string, { count: number; resetAt: number }>();
const invalidSandboxRateLimits = new Map<string, { count: number; resetAt: number }>();
const SANDBOX_RATE_LIMIT = Number(process.env.GOVHUB_SANDBOX_RATE_LIMIT || 100);
const INVALID_SANDBOX_RATE_LIMIT = Number(process.env.GOVHUB_INVALID_SANDBOX_RATE_LIMIT || 30);
const SANDBOX_RATE_WINDOW_MS = 60 * 1000;

function consumeSandboxQuota(apiKeyHash: string, now = Date.now()) {
  const current = sandboxRateLimits.get(apiKeyHash);
  if (!current || current.resetAt <= now) {
    const resetAt = now + SANDBOX_RATE_WINDOW_MS;
    sandboxRateLimits.set(apiKeyHash, { count: 1, resetAt });
    return { allowed: true, remaining: SANDBOX_RATE_LIMIT - 1, resetAt };
  }
  if (current.count >= SANDBOX_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, remaining: SANDBOX_RATE_LIMIT - current.count, resetAt: current.resetAt };
}

function consumeInvalidSandboxQuota(ipAddress: string, now = Date.now()) {
  const key = ipAddress || 'unknown';
  const current = invalidSandboxRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + SANDBOX_RATE_WINDOW_MS;
    invalidSandboxRateLimits.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: INVALID_SANDBOX_RATE_LIMIT - 1, resetAt };
  }
  if (current.count >= INVALID_SANDBOX_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, remaining: INVALID_SANDBOX_RATE_LIMIT - current.count, resetAt: current.resetAt };
}

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
  if (!query) return pathname;
  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    if (sensitiveLogKeys.has(key.toLowerCase())) {
      params.set(key, '[REDACTED]');
    }
  }
  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

export function sandboxMiddleware(db: Database.Database) {
  return (req: Request, res: Response, next: NextFunction) => {
  // Generate or forward Correlation ID
  const correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  res.setHeader('X-Correlation-ID', correlationId as string);

  // Mock Rate Limit Headers
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', '99');
  res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 60);

  // Mask sensitive values in logs (simple mock logger)
  const maskedBody = redactSandboxLogValue(req.body || {});
  
  console.log(`[SANDBOX] ${req.method} ${normalizeSandboxLogPath(req.originalUrl)} | ID: ${correlationId} | Body:`, maskedBody);

  // Enforce API Key
  const apiKey = req.headers['x-govhub-api-key'] as string;
  const apiId = getApiIdFromPath(db, req.originalUrl);

  if (!apiKey) {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: 'The X-GovHub-API-Key header is missing.',
      path: req.originalUrl,
      method: req.method
    });
    return sendSandboxError(res, 'MISSING_API_KEY', 'The X-GovHub-API-Key header is missing.', 401);
  }

  const apiKeyHash = computeApiKeyHash(apiKey);
  const requestRecord = db.prepare(`
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
    WHERE r.api_key_hash = ?
  `).get(apiKeyHash) as any;
  const accessDecision = computeApiKeyAccess(requestRecord, apiId);
  if (!requestRecord) {
    const invalidQuota = consumeInvalidSandboxQuota(req.ip || req.socket.remoteAddress || 'unknown');
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, invalidQuota.remaining)));
    res.setHeader('X-RateLimit-Reset', Math.floor(invalidQuota.resetAt / 1000));
    if (!invalidQuota.allowed) {
      return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'Too many invalid sandbox API key attempts.', 429);
    }
  } else {
    const quota = consumeSandboxQuota(apiKeyHash);
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, quota.remaining)));
    res.setHeader('X-RateLimit-Reset', Math.floor(quota.resetAt / 1000));
    if (!quota.allowed) {
      return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'The sandbox rate limit for this API key has been exceeded.', 429);
    }
  }
  if (!accessDecision.allowed && accessDecision.code !== 'UNAUTHORIZED_ENDPOINT') {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: accessDecision.message,
      path: req.originalUrl,
      method: req.method,
      provided_key: getApiKeyPreview(apiKey)
    });
    return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
  }

  // Enforce endpoint/scope verification
  if (!accessDecision.allowed && accessDecision.code === 'UNAUTHORIZED_ENDPOINT') {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
      consumer_user_id: requestRecord.consumer_user_id,
      reason: accessDecision.message,
      path: req.originalUrl,
      method: req.method,
      authorized_api: requestRecord.api_id
    });
    return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
  }

  // Key is valid and authorized
  logAuditEvent(db, 'SANDBOX_CALL_ALLOWED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
    consumer_user_id: requestRecord.consumer_user_id,
    path: req.originalUrl,
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
