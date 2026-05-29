import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  buildAccessRequestList,
  canTransferApiOwnership,
  canManageApi,
  canReviewAccessRequest,
  canSubmitAccessRequest,
  listAuditLogs,
  resolveConsumerMdaForRequest,
} from './access-control';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE mdas (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    requested_organization TEXT NOT NULL
  );
  CREATE TABLE apis (id TEXT PRIMARY KEY, name TEXT NOT NULL, owning_mda_id TEXT NOT NULL);
  CREATE TABLE access_requests (
    id TEXT PRIMARY KEY,
    consumer_mda_id TEXT,
    consumer_user_id TEXT,
    consumer_type TEXT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE audit_logs (
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

db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'NIRA', 'NIRA');
db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'MoH', 'MoH');
db.prepare('INSERT INTO users (id, full_name, account_type, requested_organization) VALUES (?, ?, ?, ?)').run('usr-public', 'Public Developer', 'public_developer', 'Independent Civic Developer');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-nira-01', 'NIRA Identity', 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-moh-01', 'MoH Registry', 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543');
db.prepare("INSERT INTO access_requests (id, consumer_mda_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'mda', ?, ?, ?)").run('req-1', 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'api-nira-01', 'Health verification', 'PENDING');
db.prepare("INSERT INTO access_requests (id, consumer_mda_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'mda', ?, ?, ?)").run('req-2', 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'api-moh-01', 'Identity sync', 'PENDING');
db.prepare("INSERT INTO access_requests (id, consumer_user_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'user', ?, ?, ?)").run('req-public', 'usr-public', 'api-nira-01', 'Civic service', 'PENDING');
db.prepare('INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?)').run('audit-1', 'ACCESS_REQUESTED', 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'api-nira-01', 'req-1', '{}');

const developer = { id: 'usr-dev', role: 'developer' as const, mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' };
const publicDeveloper = { id: 'usr-public', role: 'developer' as const, mda_id: null };
const niraOwner = { id: 'usr-owner', role: 'api_owner' as const, mda_id: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' };
const mohOwner = { id: 'usr-owner-2', role: 'api_owner' as const, mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' };
const admin = { id: 'usr-admin', role: 'admin' as const, mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' };
const reviewer = { id: 'usr-reviewer', role: 'reviewer' as const, mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' };

assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41'), {
  allowed: false,
  code: 'MDA_IMPERSONATION',
  message: 'Access requests must use the approved MDA assigned to your account.',
});
assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543'), { allowed: true, mdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', userId: 'usr-dev', consumerType: 'mda' });
assert.deepEqual(resolveConsumerMdaForRequest(publicDeveloper, null), { allowed: true, userId: 'usr-public', consumerType: 'user' });
assert.deepEqual(resolveConsumerMdaForRequest(admin, 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41'), { allowed: true, mdaId: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', userId: 'usr-admin', consumerType: 'mda' });
assert.equal(canSubmitAccessRequest(db, 'api-nira-01').allowed, true);
assert.deepEqual(canSubmitAccessRequest(db, 'missing-api'), {
  allowed: false,
  code: 'API_NOT_FOUND',
  message: 'The requested API does not exist.',
});

assert.deepEqual(buildAccessRequestList(db, developer).map((request: any) => request.id), ['req-1']);
assert.deepEqual(buildAccessRequestList(db, publicDeveloper).map((request: any) => request.id), ['req-public']);
assert.deepEqual(buildAccessRequestList(db, niraOwner).map((request: any) => request.id), ['req-1', 'req-public']);
assert.deepEqual(buildAccessRequestList(db, mohOwner).map((request: any) => request.id), ['req-2']);
assert.equal(buildAccessRequestList(db, admin).length, 3);
assert.equal(buildAccessRequestList(db, reviewer).length, 3);

assert.equal(canReviewAccessRequest(db, admin, 'req-1').allowed, true);
assert.equal(canReviewAccessRequest(db, niraOwner, 'req-1').allowed, true);
assert.equal(canReviewAccessRequest(db, mohOwner, 'req-1').allowed, false);
assert.equal(canReviewAccessRequest(db, reviewer, 'req-1').allowed, false);
db.prepare("UPDATE access_requests SET status = 'APPROVED', api_key = ?, api_key_status = 'REVOKED' WHERE id = ?").run('govhub_test_revoked', 'req-1');
assert.deepEqual(canReviewAccessRequest(db, niraOwner, 'req-1'), {
  allowed: false,
  code: 'REQUEST_ALREADY_FINALIZED',
  message: 'This access request already has a finalized API key lifecycle.',
});

assert.equal(canManageApi(db, admin, 'api-nira-01').allowed, true);
assert.equal(canManageApi(db, niraOwner, 'api-nira-01').allowed, true);
assert.equal(canManageApi(db, mohOwner, 'api-nira-01').allowed, false);
assert.equal(canTransferApiOwnership(admin).allowed, true);
assert.deepEqual(canTransferApiOwnership(niraOwner), {
  allowed: false,
  code: 'OWNER_TRANSFER_FORBIDDEN',
  message: 'Only platform administrators can transfer API ownership.',
});
db.prepare("UPDATE access_requests SET status = 'APPROVED', api_key = ?, api_key_hash = ?, api_key_preview = ?, api_key_status = 'ACTIVE' WHERE id = ?")
  .run(null, 'hash-value', 'ghk_1234...', 'req-public');
const publicRequests = buildAccessRequestList(db, publicDeveloper) as any[];
assert.equal(publicRequests[0].api_key, undefined);
assert.equal(publicRequests[0].api_key_hash, undefined);
assert.equal(publicRequests[0].api_key_preview, 'ghk_1234...');
assert.equal(listAuditLogs(db).data[0].mda_name, 'MoH');
assert.equal(listAuditLogs(db).data[0].api_name, 'NIRA Identity');

console.log('access-control tests passed');
