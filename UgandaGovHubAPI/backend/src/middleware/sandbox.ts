import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { computeApiKeyAccess, computeApiKeyHash, getApiKeyPreview, resolveSandboxApiId, type SandboxApiMapping } from '../admin';
import { logAuditEvent } from '../audit';

function getDynamicSandboxMappings(db: Database.Database): SandboxApiMapping[] {
  const rows = db.prepare('SELECT id, openapi_spec_path FROM apis WHERE sandbox_available = 1 AND openapi_spec_path IS NOT NULL').all() as any[];
  return rows.flatMap(row => {
    try {
      const specPath = path.join(__dirname, '../..', String(row.openapi_spec_path).replace(/^\/+/, ''));
      if (!fs.existsSync(specPath)) return [];
      const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as any;
      const serverUrl = spec?.servers?.[0]?.url;
      if (!serverUrl) return [];
      let sandboxPath = '';
      try {
        sandboxPath = new URL(serverUrl).pathname;
      } catch {
        sandboxPath = serverUrl.startsWith('/') ? serverUrl : '';
      }
      sandboxPath = sandboxPath.replace(/\/$/, '');
      return sandboxPath ? [{ id: row.id, sandbox_base_path: sandboxPath }] : [];
    } catch {
      return [];
    }
  });
}

function getApiIdFromPath(db: Database.Database, url: string): string | null {
  return resolveSandboxApiId(url, getDynamicSandboxMappings(db));
}

const sandboxRateLimits = new Map<string, { count: number; resetAt: number }>();
const SANDBOX_RATE_LIMIT = Number(process.env.GOVHUB_SANDBOX_RATE_LIMIT || 100);
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
  const maskedBody = { ...req.body };
  if (maskedBody.nin) maskedBody.nin = maskedBody.nin.replace(/^(.{4}).*(.{2})$/, '$1******$2');
  if (maskedBody.tin) maskedBody.tin = maskedBody.tin.replace(/^(.{2}).*(.{2})$/, '$1****$2');
  
  console.log(`[SANDBOX] ${req.method} ${req.originalUrl} | ID: ${correlationId} | Body:`, maskedBody);

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
  const quota = consumeSandboxQuota(apiKeyHash);
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, quota.remaining)));
  res.setHeader('X-RateLimit-Reset', Math.floor(quota.resetAt / 1000));
  if (!quota.allowed) {
    return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'The sandbox rate limit for this API key has been exceeded.', 429);
  }

  // Look up API Key in database
  const requestRecord = db.prepare(`
    SELECT consumer_mda_id, consumer_user_id, api_id, status, api_key_status, api_key_expires_at, api_key_revoked_at
    FROM access_requests
    WHERE api_key_hash = ?
  `).get(apiKeyHash) as any;
  const accessDecision = computeApiKeyAccess(requestRecord, apiId);
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
