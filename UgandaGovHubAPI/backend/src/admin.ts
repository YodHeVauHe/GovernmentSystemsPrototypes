import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type ApiKeyRecord = {
  status: string;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
  api_id: string;
  consumer_mda_id: string;
};

export type ApiKeyAccessDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function getDefaultApiKeyExpiry(now = new Date()) {
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + 30);
  return expiry;
}

export function normalizeExpiryInput(input?: string | null, now = new Date()) {
  const expiry = input ? new Date(input) : getDefaultApiKeyExpiry(now);
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
  if (keyStatus === 'REVOKED' || record.api_key_revoked_at) {
    return { allowed: false, code: 'REVOKED_API_KEY', message: 'The provided API key has been revoked.' };
  }
  if (keyStatus === 'DELETED') {
    return { allowed: false, code: 'INVALID_API_KEY', message: 'The provided API key is invalid or not approved.' };
  }
  if (record.api_key_expires_at && new Date(record.api_key_expires_at).getTime() <= now.getTime()) {
    return { allowed: false, code: 'EXPIRED_API_KEY', message: 'The provided API key has expired.' };
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
  { id: 'api-nira-01', sandbox_base_path: '/api/v1/identity' },
  { id: 'api-ura-01', sandbox_base_path: '/api/v1/tax' },
  { id: 'api-ursb-01', sandbox_base_path: '/api/v1/business' },
  { id: 'api-mowt-01', sandbox_base_path: '/api/v1/transport/driving-permit' },
  { id: 'api-moict-01', sandbox_base_path: '/api/v1/service-uganda' },
];

export function resolveSandboxApiId(url: string, mappings: SandboxApiMapping[] = defaultSandboxMappings) {
  const pathOnly = url.split('?')[0].replace(/\/$/, '');
  const match = mappings
    .filter(mapping => pathOnly === mapping.sandbox_base_path || pathOnly.startsWith(`${mapping.sandbox_base_path}/`))
    .sort((a, b) => b.sandbox_base_path.length - a.sandbox_base_path.length)[0];
  return match?.id || null;
}

export function ensureAdminSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_requests (
      id TEXT PRIMARY KEY,
      consumer_mda_id TEXT,
      consumer_user_id TEXT,
      consumer_type TEXT DEFAULT 'mda',
      api_id TEXT NOT NULL,
      purpose TEXT,
      status TEXT,
      api_key TEXT,
      api_key_status TEXT DEFAULT 'ACTIVE',
      api_key_expires_at TEXT,
      api_key_revoked_at TEXT,
      requested_fields TEXT,
      volume_tier TEXT,
      legal_basis TEXT,
      environment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const accessColumns = db.prepare('PRAGMA table_info(access_requests)').all() as Array<{ name: string }>;
  const consumerMdaColumn = accessColumns.find(column => column.name === 'consumer_mda_id') as ({ name: string; notnull?: number } | undefined);
  if (consumerMdaColumn?.notnull) {
    db.exec(`
      CREATE TABLE access_requests_next (
        id TEXT PRIMARY KEY,
        consumer_mda_id TEXT,
        consumer_user_id TEXT,
        consumer_type TEXT DEFAULT 'mda',
        api_id TEXT NOT NULL,
        purpose TEXT,
        status TEXT,
        api_key TEXT,
        api_key_status TEXT DEFAULT 'ACTIVE',
        api_key_expires_at TEXT,
        api_key_revoked_at TEXT,
        requested_fields TEXT,
        volume_tier TEXT,
        legal_basis TEXT,
        environment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consumer_mda_id) REFERENCES mdas (id),
        FOREIGN KEY (consumer_user_id) REFERENCES users (id),
        FOREIGN KEY (api_id) REFERENCES apis (id)
      );

      INSERT INTO access_requests_next (
        id, consumer_mda_id, consumer_user_id, consumer_type, api_id, purpose,
        status, api_key, api_key_status, api_key_expires_at, api_key_revoked_at,
        requested_fields, volume_tier, legal_basis, environment, created_at
      )
      SELECT
        id, consumer_mda_id, NULL, 'mda', api_id, purpose,
        status, api_key, api_key_status, api_key_expires_at, api_key_revoked_at,
        requested_fields, volume_tier, legal_basis, environment, created_at
      FROM access_requests;

      DROP TABLE access_requests;
      ALTER TABLE access_requests_next RENAME TO access_requests;
    `);
  }

  const refreshedAccessColumns = db.prepare('PRAGMA table_info(access_requests)').all() as Array<{ name: string }>;
  const names = new Set(refreshedAccessColumns.map(column => column.name));
  const addColumn = (name: string, definition: string) => {
    if (!names.has(name)) {
      db.exec(`ALTER TABLE access_requests ADD COLUMN ${name} ${definition}`);
    }
  };

  addColumn('api_key_status', "TEXT DEFAULT 'ACTIVE'");
  addColumn('api_key_expires_at', 'TEXT');
  addColumn('api_key_revoked_at', 'TEXT');
  addColumn('consumer_user_id', 'TEXT');
  addColumn('consumer_type', "TEXT DEFAULT 'mda'");

  const auditColumns = db.prepare('PRAGMA table_info(audit_logs)').all() as Array<{ name: string }>;
  if (auditColumns.length > 0) {
    const auditNames = new Set(auditColumns.map(column => column.name));
    const addAuditColumn = (name: string, definition: string) => {
      if (!auditNames.has(name)) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN ${name} ${definition}`);
      }
    };
    addAuditColumn('mda_id', 'TEXT');
    addAuditColumn('api_id', 'TEXT');
    addAuditColumn('request_id', 'TEXT');
    addAuditColumn('consumer_user_id', 'TEXT');
    addAuditColumn('details', 'TEXT');
    addAuditColumn('created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  }
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
