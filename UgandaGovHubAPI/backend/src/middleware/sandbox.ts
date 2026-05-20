import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../index';

function getApiIdFromPath(url: string): string | null {
  if (url.includes('/identity')) return 'api-nira-01';
  if (url.includes('/tax')) return 'api-ura-01';
  if (url.includes('/business')) return 'api-ursb-01';
  if (url.includes('/transport/driving-permit')) return 'api-mowt-01';
  if (url.includes('/service-uganda')) return 'api-moict-01';
  return null;
}

export function logAuditEvent(eventType: string, mdaId: string | null, apiId: string | null, requestId: string, details: any) {
  try {
    const id = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, eventType, mdaId, apiId, requestId, JSON.stringify(details));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export function sandboxMiddleware(req: Request, res: Response, next: NextFunction) {
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
    logAuditEvent('SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: 'The X-GovHub-API-Key header is missing.',
      path: req.originalUrl,
      method: req.method
    });
    return sendSandboxError(res, 'MISSING_API_KEY', 'The X-GovHub-API-Key header is missing.', 401);
  }

  // Look up API Key in database
  const requestRecord = db.prepare('SELECT consumer_mda_id, api_id, status FROM access_requests WHERE api_key = ?').get(apiKey) as any;
  if (!requestRecord || requestRecord.status !== 'APPROVED') {
    logAuditEvent('SANDBOX_CALL_DENIED', null, apiId, correlationId as string, {
      reason: 'The provided API key is invalid, revoked, or not approved.',
      path: req.originalUrl,
      method: req.method,
      provided_key: apiKey.substring(0, 15) + '...'
    });
    return sendSandboxError(res, 'INVALID_API_KEY', 'The provided API key is invalid, revoked, or not approved.', 403);
  }

  // Enforce endpoint/scope verification
  if (requestRecord.api_id !== apiId) {
    logAuditEvent('SANDBOX_CALL_DENIED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
      reason: 'The API key is not authorized for this API endpoint.',
      path: req.originalUrl,
      method: req.method,
      authorized_api: requestRecord.api_id
    });
    return sendSandboxError(res, 'UNAUTHORIZED_ENDPOINT', 'The provided API key is not authorized to access this API.', 403);
  }

  // Key is valid and authorized
  logAuditEvent('SANDBOX_CALL_ALLOWED', requestRecord.consumer_mda_id, apiId, correlationId as string, {
    path: req.originalUrl,
    method: req.method
  });

  next();
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
