import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  buildRegisteredSandboxMappings,
  computeApiKeyHash,
  computeApiKeyAccess,
  ensureAdminSchema,
  resolveSandboxApiId,
  getDefaultApiKeyExpiry,
  normalizeExpiryInput,
  removeExistingSpecFiles,
  resolveOpenApiFilePath,
} from './admin';

const now = new Date('2026-05-21T10:00:00.000Z');

assert.equal(computeApiKeyHash('ghk_test_secret').length, 64);
assert.equal(computeApiKeyHash('ghk_test_secret'), computeApiKeyHash('ghk_test_secret'));

assert.equal(getDefaultApiKeyExpiry(now).toISOString(), '2026-06-20T10:00:00.000Z');
assert.equal(normalizeExpiryInput(undefined, now), '2026-06-20T10:00:00.000Z');
assert.equal(normalizeExpiryInput('2026-05-22T10:00:00.000Z', now), '2026-05-22T10:00:00.000Z');
assert.throws(() => normalizeExpiryInput('2026-05-20T10:00:00.000Z', now), /future/);
assert.throws(() => normalizeExpiryInput('not-a-date', now), /valid ISO/);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    },
    'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    now
  ),
  { allowed: true }
);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'REVOKED',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: '2026-05-21T09:00:00.000Z',
      api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    },
    'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    now
  ),
  { allowed: false, code: 'REVOKED_API_KEY', message: 'The provided API key has been revoked.' }
);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T09:59:59.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    },
    'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    now
  ),
  { allowed: false, code: 'EXPIRED_API_KEY', message: 'The provided API key has expired.' }
);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      consumer_user_id: 'usr-suspended',
      consumer_user_status: 'SUSPENDED',
    },
    'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    now
  ),
  { allowed: false, code: 'ACCOUNT_NOT_APPROVED', message: 'The API key owner account is not approved.' }
);
assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
      consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      consumer_user_id: 'usr-mda-suspended',
      consumer_user_status: 'SUSPENDED',
    },
    'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    now
  ),
  { allowed: false, code: 'ACCOUNT_NOT_APPROVED', message: 'The API key owner account is not approved.' }
);

assert.deepEqual(removeExistingSpecFiles(['/openapi/a.yaml', '/openapi/a.yaml', null, '../bad.yaml']), [
  '/openapi/a.yaml',
]);
assert.equal(resolveOpenApiFilePath('/srv/app/openapi', '/openapi/a.yaml'), '/srv/app/openapi/a.yaml');
assert.throws(() => resolveOpenApiFilePath('/srv/app/openapi', '/openapi/../secrets.txt'), /Invalid OpenAPI path/);
assert.throws(() => resolveOpenApiFilePath('/srv/app/openapi', '/etc/passwd'), /Invalid OpenAPI path/);

assert.equal(resolveSandboxApiId('/api/v1/identity/verify-nin'), 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6');
assert.equal(resolveSandboxApiId('/api/v1/registry/status', [
  { id: 'api-custom-01', sandbox_base_path: '/api/v1/registry' },
]), 'api-custom-01');
assert.equal(resolveSandboxApiId('/api/v1/unknown', [
  { id: 'api-custom-01', sandbox_base_path: '/api/v1/registry' },
]), null);
assert.deepEqual(buildRegisteredSandboxMappings([
  { id: 'api-reg-123', sandbox_available: 1 },
  { id: 'api-offline', sandbox_available: 0 },
]), [
  { id: 'api-reg-123', sandbox_base_path: '/api/v1/sandbox/api-reg-123' },
]);
assert.equal(resolveSandboxApiId('/api/v1/identity/verify-nin', buildRegisteredSandboxMappings([
  { id: 'api-evil', sandbox_available: 1 },
])), null);
assert.equal(resolveSandboxApiId('/api/v1/sandbox/api-evil/status', buildRegisteredSandboxMappings([
  { id: 'api-evil', sandbox_available: 1 },
])), 'api-evil');

const partialDb = new Database(':memory:');
partialDb.exec(`
  CREATE TABLE mdas (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
  CREATE TABLE apis (id TEXT PRIMARY KEY, name TEXT NOT NULL, owning_mda_id TEXT NOT NULL);
`);
assert.doesNotThrow(() => ensureAdminSchema(partialDb));
assert.deepEqual(
  partialDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('access_requests', 'audit_logs') ORDER BY name").all(),
  [{ name: 'access_requests' }, { name: 'audit_logs' }]
);
partialDb.close();

console.log('admin tests passed');
