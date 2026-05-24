import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  canDownloadOpenApiAsset,
  canViewApiDocs,
  ensureDocsSchema,
  listVisibleDocsApis,
  resolveDocsVisibility,
  type DocsDecision,
} from './docs-access';

const db = new Database(':memory:');

function deniedCode(decision: DocsDecision) {
  assert.equal(decision.allowed, false);
  return decision.code;
}

db.exec(`
  CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owning_mda_id TEXT NOT NULL,
    sector TEXT,
    description TEXT,
    lifecycle_status TEXT,
    sensitivity_level TEXT,
    security_classification TEXT,
    sandbox_available BOOLEAN,
    required_approval_level TEXT,
    contact_office TEXT,
    openapi_spec_path TEXT
  );

  CREATE TABLE access_requests (
    id TEXT PRIMARY KEY,
    consumer_mda_id TEXT,
    consumer_user_id TEXT,
    consumer_type TEXT,
    api_id TEXT NOT NULL,
    status TEXT,
    api_key TEXT,
    api_key_hash TEXT,
    api_key_status TEXT DEFAULT 'ACTIVE',
    api_key_expires_at TEXT
  );
`);

ensureDocsSchema(db);

db.prepare(`
  INSERT INTO apis (
    id, name, owning_mda_id, lifecycle_status, sensitivity_level,
    security_classification, sandbox_available, openapi_spec_path, docs_visibility
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('api-public', 'Public Registry', 'mda-03', 'Production', 'Low', 'Public', 1, '/openapi/public.yaml', 'public');

db.prepare(`
  INSERT INTO apis (
    id, name, owning_mda_id, lifecycle_status, sensitivity_level,
    security_classification, sandbox_available, openapi_spec_path, docs_visibility
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('api-auth', 'Authenticated Registry', 'mda-02', 'Beta', 'Medium', 'Official', 1, '/openapi/auth.yaml', 'authenticated');

db.prepare(`
  INSERT INTO apis (
    id, name, owning_mda_id, lifecycle_status, sensitivity_level,
    security_classification, sandbox_available, openapi_spec_path, docs_visibility
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('api-restricted', 'Restricted Registry', 'mda-01', 'Production', 'High', 'Restricted', 1, '/openapi/restricted.yaml', 'restricted');

db.prepare(`
  INSERT INTO access_requests (
    id, consumer_mda_id, consumer_type, api_id, status, api_key_hash, api_key_status, api_key_expires_at
  ) VALUES (?, ?, 'mda', ?, ?, ?, ?, ?)
`).run('req-approved', 'mda-06', 'api-restricted', 'APPROVED', 'hashed_key', 'ACTIVE', null);
db.prepare(`
  INSERT INTO access_requests (
    id, consumer_user_id, consumer_type, api_id, status, api_key_hash, api_key_status, api_key_expires_at
  ) VALUES (?, ?, 'user', ?, ?, ?, ?, ?)
`).run('req-public-approved', 'usr-public', 'api-restricted', 'APPROVED', 'hashed_public_key', 'ACTIVE', null);

const developer = { id: 'usr-dev', status: 'APPROVED' as const, role: 'developer' as const, mda_id: 'mda-06' };
const publicDeveloper = { id: 'usr-public', status: 'APPROVED' as const, role: 'developer' as const, mda_id: null };
const otherDeveloper = { id: 'usr-other', status: 'APPROVED' as const, role: 'developer' as const, mda_id: 'mda-04' };
const pendingDeveloper = { id: 'usr-pending', status: 'PENDING_REVIEW' as const, role: null, mda_id: null };
const owner = { id: 'usr-owner', status: 'APPROVED' as const, role: 'api_owner' as const, mda_id: 'mda-01' };
const reviewer = { id: 'usr-reviewer', status: 'APPROVED' as const, role: 'reviewer' as const, mda_id: 'mda-05' };
const admin = { id: 'usr-admin', status: 'APPROVED' as const, role: 'admin' as const, mda_id: 'mda-05' };

assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Public' }), 'public');
assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Official' }), 'authenticated');
assert.equal(resolveDocsVisibility({ docs_visibility: null, security_classification: 'Restricted' }), 'restricted');
assert.equal(resolveDocsVisibility({ docs_visibility: 'PUBLIC', security_classification: 'Restricted' }), 'public');

assert.deepEqual(canViewApiDocs(db, null, 'api-public'), { allowed: true, visibility: 'public' });
assert.equal(deniedCode(canViewApiDocs(db, null, 'api-auth')), 'UNAUTHENTICATED');
assert.equal(deniedCode(canViewApiDocs(db, pendingDeveloper, 'api-auth')), 'ACCOUNT_NOT_APPROVED');
assert.deepEqual(canViewApiDocs(db, developer, 'api-auth'), { allowed: true, visibility: 'authenticated' });

assert.deepEqual(canViewApiDocs(db, admin, 'api-restricted'), { allowed: true, visibility: 'restricted' });
assert.deepEqual(canViewApiDocs(db, reviewer, 'api-restricted'), { allowed: true, visibility: 'restricted' });
assert.deepEqual(canViewApiDocs(db, owner, 'api-restricted'), { allowed: true, visibility: 'restricted' });
assert.deepEqual(canViewApiDocs(db, developer, 'api-restricted'), { allowed: true, visibility: 'restricted' });
assert.deepEqual(canViewApiDocs(db, publicDeveloper, 'api-restricted'), { allowed: true, visibility: 'restricted' });
assert.equal(deniedCode(canViewApiDocs(db, otherDeveloper, 'api-restricted')), 'FORBIDDEN');
assert.equal(deniedCode(canViewApiDocs(db, developer, 'missing-api')), 'NOT_FOUND');

assert.equal(canDownloadOpenApiAsset(db, null, '/openapi/public.yaml').allowed, true);
assert.equal(deniedCode(canDownloadOpenApiAsset(db, null, '/openapi/restricted.yaml')), 'UNAUTHENTICATED');
assert.equal(canDownloadOpenApiAsset(db, developer, '/openapi/restricted.yaml').allowed, true);
assert.equal(canDownloadOpenApiAsset(db, publicDeveloper, '/openapi/restricted.yaml').allowed, true);
assert.equal(deniedCode(canDownloadOpenApiAsset(db, otherDeveloper, '/openapi/restricted.yaml')), 'FORBIDDEN');
assert.equal(deniedCode(canDownloadOpenApiAsset(db, admin, '/openapi/missing.yaml')), 'NOT_FOUND');

assert.deepEqual(listVisibleDocsApis(db, null).map(api => api.id), ['api-public']);
assert.deepEqual(listVisibleDocsApis(db, developer).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);
assert.deepEqual(listVisibleDocsApis(db, publicDeveloper).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);
assert.deepEqual(listVisibleDocsApis(db, otherDeveloper).map(api => api.id), ['api-auth', 'api-public']);
assert.deepEqual(listVisibleDocsApis(db, admin).map(api => api.id), ['api-auth', 'api-public', 'api-restricted']);

console.log('docs-access tests passed');
