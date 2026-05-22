import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { computeApiKeyAccess } from '../admin';
import { logAuditEvent } from '../audit';

function getApiIdFromPath(url: string): string | null {
  if (url.includes('/identity')) return 'api-nira-01';
  if (url.includes('/tax')) return 'api-ura-01';
  if (url.includes('/business')) return 'api-ursb-01';
  if (url.includes('/transport/driving-permit')) return 'api-mowt-01';
  if (url.includes('/service-uganda')) return 'api-moict-01';
  return null;
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
  const apiId = getApiIdFromPath(req.originalUrl);

  if (!apiKey) {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: 'The X-GovHub-API-Key header is missing.',
      path: req.originalUrl,
      method: req.method
    });
    return sendSandboxError(res, 'MISSING_API_KEY', 'The X-GovHub-API-Key header is missing.', 401);
  }

  // Look up API Key in database
  const requestRecord = db.prepare(`
    SELECT consumer_mda_id, api_id, status, api_key_status, api_key_expires_at, api_key_revoked_at
    FROM access_requests
    WHERE api_key = ?
  `).get(apiKey) as any;
  const accessDecision = computeApiKeyAccess(requestRecord, apiId);
  if (!accessDecision.allowed && accessDecision.code !== 'UNAUTHORIZED_ENDPOINT') {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: accessDecision.message,
      path: req.originalUrl,
      method: req.method,
      provided_key: apiKey.substring(0, 15) + '...'
    });
    return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
  }

  // Enforce endpoint/scope verification
  if (!accessDecision.allowed && accessDecision.code === 'UNAUTHORIZED_ENDPOINT') {
    logAuditEvent(db, 'SANDBOX_CALL_DENIED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
      reason: accessDecision.message,
      path: req.originalUrl,
      method: req.method,
      authorized_api: requestRecord.api_id
    });
    return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
  }

  // Key is valid and authorized
  logAuditEvent(db, 'SANDBOX_CALL_ALLOWED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
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
