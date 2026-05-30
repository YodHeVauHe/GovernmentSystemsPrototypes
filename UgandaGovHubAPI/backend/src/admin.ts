import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DbClient } from './db';
import { exec, hasColumn, many, run } from './db';

export type ApiKeyRecord = {
  status: string;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
  api_id: string;
  consumer_mda_id: string;
  consumer_user_id?: string | null;
  consumer_user_status?: string | null;
};

export type ApiKeyAccessDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function getDefaultApiKeyExpiry(now = new Date()) {
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + 30);
  return expiry;
}

export function computeApiKeyHash(apiKey: string) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function getApiKeyPreview(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

export function normalizeExpiryInput(input?: unknown, now = new Date()) {
  if (input !== undefined && input !== null && typeof input !== 'string') {
    throw new Error('API key expiry must be a valid ISO date.');
  }

  const normalizedInput = typeof input === 'string' ? input.trim() : '';
  const expiry = normalizedInput ? new Date(normalizedInput) : getDefaultApiKeyExpiry(now);
  if (Number.isNaN(expiry.getTime())) {
    throw new Error('API key expiry must be a valid ISO date.');
  }
  if (expiry.getTime() <= now.getTime()) {
    throw new Error('API key expiry must be in the future.');
  }
  return expiry.toISOString();
}

export function computeApiKeyAccess(record: ApiKeyRecord | undefined | null, apiId: string | null, now = new Date()): ApiKeyAccessDecision {
  if (!record || record.status !== 'APPROVED') {
    return { allowed: false, code: 'INVALID_API_KEY', message: 'The provided API key is invalid or not approved.' };
  }

  const keyStatus = record.api_key_status || 'ACTIVE';
  if (!['ACTIVE', 'REVOKED', 'DELETED'].includes(keyStatus)) {
    return { allowed: false, code: 'INVALID_API_KEY', message: 'The provided API key status is invalid.' };
  }
  if (keyStatus === 'REVOKED' || record.api_key_revoked_at) {
    return { allowed: false, code: 'REVOKED_API_KEY', message: 'The provided API key has been revoked.' };
  }
  if (keyStatus === 'DELETED') {
    return { allowed: false, code: 'INVALID_API_KEY', message: 'The provided API key is invalid or not approved.' };
  }
  if (record.api_key_expires_at) {
    const expiresAt = new Date(record.api_key_expires_at).getTime();
    if (Number.isNaN(expiresAt)) {
      return { allowed: false, code: 'INVALID_API_KEY', message: 'The provided API key expiry is invalid.' };
    }
    if (expiresAt <= now.getTime()) {
      return { allowed: false, code: 'EXPIRED_API_KEY', message: 'The provided API key has expired.' };
    }
  }
  if (record.consumer_user_id && record.consumer_user_status !== 'APPROVED') {
    return { allowed: false, code: 'ACCOUNT_NOT_APPROVED', message: 'The API key owner account is not approved.' };
  }
  if (record.api_id !== apiId) {
    return { allowed: false, code: 'UNAUTHORIZED_ENDPOINT', message: 'The provided API key is not authorized to access this API.' };
  }

  return { allowed: true };
}

export type SandboxApiMapping = {
  id: string;
  sandbox_base_path: string;
};

const defaultSandboxMappings: SandboxApiMapping[] = [
  { id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6', sandbox_base_path: '/api/v1/identity' },
  { id: 'api-ura-13897843-012d-4951-8b06-374fff183c3e', sandbox_base_path: '/api/v1/tax' },
  { id: 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65', sandbox_base_path: '/api/v1/business' },
  { id: 'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7', sandbox_base_path: '/api/v1/transport/driving-permit' },
  { id: 'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac', sandbox_base_path: '/api/v1/service-uganda' },
];

export function resolveSandboxApiId(url: string, mappings: SandboxApiMapping[] = defaultSandboxMappings) {
  const pathOnly = url.split('?')[0].replace(/\/$/, '');
  const match = mappings
    .filter(mapping => pathOnly === mapping.sandbox_base_path || pathOnly.startsWith(`${mapping.sandbox_base_path}/`))
    .sort((a, b) => b.sandbox_base_path.length - a.sandbox_base_path.length)[0];
  return match?.id || null;
}

export function buildRegisteredSandboxMappings(rows: Array<{ id: string; sandbox_available?: number | boolean | null }>): SandboxApiMapping[] {
  return rows
    .filter(row => Boolean(row.sandbox_available))
    .map(row => ({
      id: row.id,
      sandbox_base_path: `/api/v1/sandbox/${encodeURIComponent(row.id)}`,
    }));
}

export function resolveOpenApiFilePath(openapiRoot: string, specPath: string) {
  const normalizedRoot = path.resolve(openapiRoot);
  if (typeof specPath !== 'string' || !specPath.startsWith('/openapi/') || specPath.includes('..')) {
    throw new Error('Invalid OpenAPI path.');
  }
  const relativePath = specPath.replace(/^\/openapi\/+/, '');
  const absolutePath = path.resolve(normalizedRoot, relativePath);
  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error('Invalid OpenAPI path.');
  }
  return absolutePath;
}

export async function ensureAdminSchema(db: DbClient) {
  await exec(db, `
    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      consumer_mda_id TEXT,
      consumer_user_id TEXT,
      consumer_type TEXT DEFAULT 'mda',
      api_id TEXT NOT NULL,
      purpose TEXT,
      status TEXT,
      api_key TEXT,
      api_key_hash TEXT,
      api_key_preview TEXT,
      api_key_status TEXT DEFAULT 'ACTIVE',
      api_key_expires_at TEXT,
      api_key_revoked_at TEXT,
      requested_fields TEXT,
      volume_tier TEXT,
      legal_basis TEXT,
      environment TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consumer_mda_id) REFERENCES mdas (id),
      FOREIGN KEY (consumer_user_id) REFERENCES users (id),
      FOREIGN KEY (api_id) REFERENCES apis (id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      mda_id TEXT,
      consumer_user_id TEXT,
      api_id TEXT,
      request_id TEXT,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const addColumn = async (name: string, definition: string) => {
    if (!await hasColumn(db, 'access_requests', name)) {
      await exec(db, `ALTER TABLE access_requests ADD COLUMN ${name} ${definition}`);
    }
  };

  await addColumn('api_key_status', "TEXT DEFAULT 'ACTIVE'");
  await addColumn('api_key_hash', 'TEXT');
  await addColumn('api_key_preview', 'TEXT');
  await addColumn('api_key_expires_at', 'TEXT');
  await addColumn('api_key_revoked_at', 'TEXT');
  await addColumn('consumer_user_id', 'TEXT');
  await addColumn('consumer_type', "TEXT DEFAULT 'mda'");

  const plaintextKeys = await many<{ id: string; api_key: string }>(db, 'SELECT id, api_key FROM access_requests WHERE api_key IS NOT NULL AND api_key_hash IS NULL');
  for (const row of plaintextKeys) {
    await run(db, 'UPDATE access_requests SET api_key_hash = $1, api_key_preview = $2, api_key = NULL WHERE id = $3', [
      computeApiKeyHash(row.api_key),
      getApiKeyPreview(row.api_key),
      row.id,
    ]);
  }

  const addAuditColumn = async (name: string, definition: string) => {
    if (!await hasColumn(db, 'audit_logs', name)) {
      await exec(db, `ALTER TABLE audit_logs ADD COLUMN ${name} ${definition}`);
    }
  };
  await addAuditColumn('mda_id', 'TEXT');
  await addAuditColumn('api_id', 'TEXT');
  await addAuditColumn('request_id', 'TEXT');
  await addAuditColumn('consumer_user_id', 'TEXT');
  await addAuditColumn('details', 'TEXT');
  await addAuditColumn('created_at', 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
}

export function removeExistingSpecFiles(specPaths: Array<string | null | undefined>) {
  return Array.from(new Set(
    specPaths.filter((specPath): specPath is string => {
      return typeof specPath === 'string' && specPath.startsWith('/openapi/') && !specPath.includes('..');
    })
  ));
}

export function deleteSpecFiles(specPaths: string[], openapiRoot: string) {
  for (const specPath of specPaths) {
    const filename = path.basename(specPath);
    const absolutePath = path.join(openapiRoot, filename);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  }
}
