import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { computeApiKeyAccess, computeApiKeyHash, getApiKeyPreview, resolveSandboxApiId } from '../admin';
import { logAuditEvent } from '../audit';
import { consumeRateLimit } from '../rate-limit';
import type { Db } from '../db';
import { one } from '../db';
import { positiveIntegerEnv } from '../env';

function registeredSandboxApiIdFromPath(url: string) {
  const pathname = new URL(url, 'http://sandbox.local').pathname.replace(/\/+$/, '');
  const match = /^\/api\/v1\/sandbox\/([^/?#]+)/i.exec(pathname);
  if (!match) return null;

  try {
    const apiId = decodeURIComponent(match[1]);
    return apiId && !apiId.includes('/') ? apiId : null;
  } catch {
    return null;
  }
}

async function getApiIdFromPath(db: Db, url: string): Promise<string | null> {
  const defaultApiId = resolveSandboxApiId(url);
  if (defaultApiId) {
    const api = await one<{ id: string }>(db, 'SELECT id FROM apis WHERE id = $1 AND sandbox_available = TRUE', [defaultApiId]);
    return api?.id || null;
  }

  const registeredApiId = registeredSandboxApiIdFromPath(url);
  if (!registeredApiId) return null;

  const api = await one<{ id: string }>(db, 'SELECT id FROM apis WHERE id = $1 AND sandbox_available = TRUE', [registeredApiId]);
  return api?.id || null;
}

const SANDBOX_RATE_LIMIT = positiveIntegerEnv('GOVHUB_SANDBOX_RATE_LIMIT', 100);
const INVALID_SANDBOX_RATE_LIMIT = positiveIntegerEnv('GOVHUB_INVALID_SANDBOX_RATE_LIMIT', 30);
const SANDBOX_RATE_WINDOW_MS = 60 * 1000;

const identifierLogKeys = new Set([
  'nin',
  'nationalid',
  'nationalidentificationnumber',
  'tin',
  'tinnumber',
  'taxidentificationnumber',
  'taxpayeridentificationnumber',
  'brn',
  'businessregistrationnumber',
  'permitnumber',
  'permitno',
  'drivingpermitnumber',
  'nationalidnumber',
  'cardnumber',
  'ursbnumber',
]);
const sensitiveExactLogKeys = new Set([
  'authorization',
  'cookie',
  'password',
  'passwd',
  'apikey',
  'xgovhubapikey',
]);
const personalDataLogKeys = new Set([
  'address',
  'birthdate',
  'companyname',
  'contactemail',
  'contactphone',
  'dateofbirth',
  'dob',
  'email',
  'emailaddress',
  'firstname',
  'fullname',
  'givenname',
  'lastname',
  'mobilenumber',
  'name',
  'phonenumber',
  'postaladdress',
  'registeredname',
  'residentialaddress',
  'surname',
]);

function normalizeLogKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSensitiveLogKey(key: string) {
  const normalizedKey = normalizeLogKey(key);
  return identifierLogKeys.has(normalizedKey)
    || personalDataLogKeys.has(normalizedKey)
    || sensitiveExactLogKeys.has(normalizedKey)
    || normalizedKey.endsWith('token')
    || normalizedKey.endsWith('secret')
    || (normalizedKey.length > 'key'.length && normalizedKey.endsWith('key'));
}

const sensitiveLogValuePatterns = [
  /^[a-z]{2}\d{11}[a-z]$/i,
  /^\d{10}$/,
  /^\d{14}$/,
  /^brn\d{5,}$/i,
  /^wp\d{5}[a-z]*$/i,
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i,
  /^\+\d[\d\s().-]{7,}\d$/,
];

function redactSensitiveLogString(value: string) {
  const trimmedValue = value.trim();
  return sensitiveLogValuePatterns.some(pattern => pattern.test(trimmedValue)) ? '[REDACTED]' : value;
}

const sensitivePathSegmentPatterns = [
  /^\/api\/v1\/identity\/(?:status|card-status|death-status)\/[^/?#]+/,
  /^\/api\/v1\/tax\/(?:tin-status|clearance|vat-status|importer-status|filing-obligations|withholding-exemption)\/[^/?#]+/,
  /^\/api\/v1\/business\/(?:registration|company-status|directors|beneficial-ownership|annual-return-status)\/[^/?#]+/,
  /^\/api\/v1\/transport\/(?:driving-permit\/(?:status|classes)|driver-test-results)\/[^/?#]+/,
  /^\/api\/v1\/service-uganda\/(?:cases|case-status|service-bundle)\/[^/?#]+/,
];

function redactCanonicalDrivingPermitPath(pathname: string) {
  return pathname.replace(
    /^\/api\/v1\/transport\/driving-permit\/[^/?#]+\/(?:status|classes)(?=$|[/?#])/,
    match => {
      const lastSlash = match.lastIndexOf('/');
      return `/api/v1/transport/driving-permit/[REDACTED]${match.slice(lastSlash)}`;
    }
  );
}

export function redactSandboxLogValue(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveLogString(value);
  if (Array.isArray(value)) return value.map(item => redactSandboxLogValue(item));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
    const normalizedKey = normalizeLogKey(key);
    if (normalizedKey === 'nin' && typeof nestedValue === 'string') {
      return [key, nestedValue.replace(/^(.{4}).*(.{2})$/, '$1******$2')];
    }
    if (normalizedKey === 'tin' && typeof nestedValue === 'string') {
      return [key, nestedValue.replace(/^(.{2}).*(.{2})$/, '$1****$2')];
    }
    if (identifierLogKeys.has(normalizedKey)) {
      return [key, '[REDACTED]'];
    }
    if (isSensitiveLogKey(key)) {
      return [key, '[REDACTED]'];
    }
    return [key, redactSandboxLogValue(nestedValue)];
  }));
}

export function normalizeSandboxLogPath(pathWithQuery: string) {
  const [pathname, query = ''] = pathWithQuery.split('?');
  const dynamicallyRedactedPath = pathname.replace(
    /^(\/api\/v1\/sandbox\/[^/?#]+)(?:\/[^?#]*)?/,
    '$1/[REDACTED]'
  );
  const redactedPathname = sensitivePathSegmentPatterns.reduce(
    (currentPath, pattern) => currentPath.replace(pattern, match => {
      const lastSlash = match.lastIndexOf('/');
      return `${match.slice(0, lastSlash + 1)}[REDACTED]`;
    }),
    redactCanonicalDrivingPermitPath(dynamicallyRedactedPath)
  );
  if (!query) return redactedPathname;
  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    if (isSensitiveLogKey(key)) {
      params.set(key, '[REDACTED]');
    }
  }
  const nextQuery = params.toString();
  return nextQuery ? `${redactedPathname}?${nextQuery}` : redactedPathname;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SANDBOX_API_KEY_RE = /^ghk_[0-9a-f]{64}$/;

type SandboxApiKeyHeader =
  | { ok: true; apiKey: string }
  | { ok: false; code: 'MISSING_API_KEY' | 'INVALID_API_KEY'; message: string };

function parseSandboxApiKeyHeader(header: string | string[] | undefined): SandboxApiKeyHeader {
  if (typeof header === 'string') {
    const apiKey = header.trim();
    if (apiKey.length === 0) {
      return { ok: false, code: 'MISSING_API_KEY', message: 'The X-GovHub-API-Key header is missing.' };
    }
    if (!SANDBOX_API_KEY_RE.test(apiKey)) {
      return { ok: false, code: 'INVALID_API_KEY', message: 'The X-GovHub-API-Key header is invalid.' };
    }
    return { ok: true, apiKey };
  }
  if (Array.isArray(header)) {
    return { ok: false, code: 'INVALID_API_KEY', message: 'The X-GovHub-API-Key header must be a single value.' };
  }
  return { ok: false, code: 'MISSING_API_KEY', message: 'The X-GovHub-API-Key header is missing.' };
}

async function consumeInvalidSandboxQuota(db: Db, req: Request, res: Response) {
  const invalidQuota = await consumeRateLimit(db, 'sandbox_invalid', req.ip || req.socket.remoteAddress || 'unknown', INVALID_SANDBOX_RATE_LIMIT, SANDBOX_RATE_WINDOW_MS);
  res.setHeader('X-RateLimit-Limit', String(INVALID_SANDBOX_RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, invalidQuota.remaining)));
  res.setHeader('X-RateLimit-Reset', Math.floor(invalidQuota.resetAt / 1000));
  return invalidQuota;
}

type SandboxAuditLogContext = {
  eventType?: 'SANDBOX_CALL_ALLOWED' | 'SANDBOX_CALL_DENIED';
  mdaId: string | null;
  apiId: string | null;
  correlationId: string;
  details: Record<string, unknown>;
};

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
    let responseBody: unknown = null;
    let auditLogContext: SandboxAuditLogContext | null = null;
    const originalJson = res.json.bind(res);
    res.json = ((body?: any) => {
      responseBody = redactSandboxLogValue(body);
      return originalJson(body);
    }) as Response['json'];

    res.once('finish', () => {
      if (!auditLogContext) return;
      const responseStatus = res.statusCode;
      const eventType = auditLogContext.eventType || (
        responseStatus >= 400 ? 'SANDBOX_CALL_DENIED' : 'SANDBOX_CALL_ALLOWED'
      );

      logAuditEvent(db, eventType, auditLogContext.mdaId, auditLogContext.apiId, auditLogContext.correlationId, {
        ...auditLogContext.details,
        response_status: responseStatus,
        response_code: responseStatus,
        response_body: responseBody,
      }).catch(err => {
        console.error('Failed to write sandbox response audit log:', err);
      });
    });

    function recordSandboxAudit(context: SandboxAuditLogContext) {
      auditLogContext = context;
    }

    // Enforce API Key
    const apiKeyHeader = parseSandboxApiKeyHeader(req.headers['x-govhub-api-key']);
    if (!apiKeyHeader.ok) {
      res.locals.sandboxApiId = null;
      const invalidQuota = await consumeInvalidSandboxQuota(db, req, res);
      if (!invalidQuota.allowed) {
        recordSandboxAudit({
          eventType: 'SANDBOX_CALL_DENIED',
          mdaId: null,
          apiId: null,
          correlationId,
          details: {
            reason: 'Too many invalid sandbox API key attempts.',
            path: auditPath,
            method: req.method,
          },
        });
        return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'Too many invalid sandbox API key attempts.', 429);
      }
      recordSandboxAudit({
        eventType: 'SANDBOX_CALL_DENIED',
        mdaId: null,
        apiId: null,
        correlationId,
        details: {
          reason: apiKeyHeader.message,
          path: auditPath,
          method: req.method,
        },
      });
      return sendSandboxError(res, apiKeyHeader.code, apiKeyHeader.message, 401);
    }

    const apiKey = apiKeyHeader.apiKey;
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
        r.api_key_revoked_at,
        r.environment
      FROM access_requests r
      LEFT JOIN users u ON u.id = r.consumer_user_id
      WHERE r.api_key_hash = $1
    `, [apiKeyHash]);

    if (!requestRecord) {
      res.locals.sandboxApiId = null;
      const invalidQuota = await consumeInvalidSandboxQuota(db, req, res);
      if (!invalidQuota.allowed) {
        recordSandboxAudit({
          eventType: 'SANDBOX_CALL_DENIED',
          mdaId: null,
          apiId: null,
          correlationId,
          details: {
            reason: 'Too many invalid sandbox API key attempts.',
            path: auditPath,
            method: req.method,
            provided_key: getApiKeyPreview(apiKey),
          },
        });
        return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'Too many invalid sandbox API key attempts.', 429);
      }
      recordSandboxAudit({
        eventType: 'SANDBOX_CALL_DENIED',
        mdaId: null,
        apiId: null,
        correlationId,
        details: {
          reason: 'The provided API key is invalid or not approved.',
          path: auditPath,
          method: req.method,
          provided_key: getApiKeyPreview(apiKey),
        },
      });
      return sendSandboxError(res, 'INVALID_API_KEY', 'The provided API key is invalid or not approved.', 401);
    }

    const apiId = await getApiIdFromPath(db, req.originalUrl);
    res.locals.sandboxApiId = apiId;

    const quota = await consumeRateLimit(db, 'sandbox', apiKeyHash, SANDBOX_RATE_LIMIT, SANDBOX_RATE_WINDOW_MS);
    res.setHeader('X-RateLimit-Limit', String(SANDBOX_RATE_LIMIT));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, quota.remaining)));
    res.setHeader('X-RateLimit-Reset', Math.floor(quota.resetAt / 1000));
    if (!quota.allowed) {
      recordSandboxAudit({
        eventType: 'SANDBOX_CALL_DENIED',
        mdaId: requestRecord.consumer_mda_id,
        apiId,
        correlationId,
        details: {
          consumer_user_id: requestRecord.consumer_user_id,
          reason: 'The sandbox rate limit for this API key has been exceeded.',
          path: auditPath,
          method: req.method,
        },
      });
      return sendSandboxError(res, 'RATE_LIMIT_EXCEEDED', 'The sandbox rate limit for this API key has been exceeded.', 429);
    }

    const accessDecision = computeApiKeyAccess(requestRecord, apiId);

    if (accessDecision.allowed === false && accessDecision.code !== 'UNAUTHORIZED_ENDPOINT') {
      recordSandboxAudit({
        eventType: 'SANDBOX_CALL_DENIED',
        mdaId: requestRecord?.consumer_mda_id || null,
        apiId,
        correlationId,
        details: {
          consumer_user_id: requestRecord?.consumer_user_id,
          reason: accessDecision.message,
          path: auditPath,
          method: req.method,
          provided_key: getApiKeyPreview(apiKey),
        },
      });
      return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
    }

    // Enforce endpoint/scope verification
    if (accessDecision.allowed === false && accessDecision.code === 'UNAUTHORIZED_ENDPOINT') {
      recordSandboxAudit({
        eventType: 'SANDBOX_CALL_DENIED',
        mdaId: requestRecord.consumer_mda_id,
        apiId,
        correlationId,
        details: {
          consumer_user_id: requestRecord.consumer_user_id,
          reason: accessDecision.message,
          path: auditPath,
          method: req.method,
          authorized_api: requestRecord.api_id,
        },
      });
      return sendSandboxError(res, accessDecision.code, accessDecision.message, 403);
    }

    recordSandboxAudit({
      mdaId: requestRecord.consumer_mda_id,
      apiId,
      correlationId,
      details: {
        consumer_user_id: requestRecord.consumer_user_id,
        path: auditPath,
        method: req.method,
      },
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

export function sandboxNotFoundHandler(_req: Request, res: Response) {
  return sendSandboxError(
    res,
    'SANDBOX_ENDPOINT_NOT_FOUND',
    'The requested sandbox endpoint is not implemented for this API.',
    404,
  );
}
