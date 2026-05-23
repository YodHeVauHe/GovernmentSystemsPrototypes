import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  buildAccessRequestList,
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
    api_key_status TEXT DEFAULT 'ACTIVE',
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

db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-01', 'NIRA', 'NIRA');
db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-06', 'MoH', 'MoH');
db.prepare('INSERT INTO users (id, full_name, account_type, requested_organization) VALUES (?, ?, ?, ?)').run('usr-public', 'Public Developer', 'public_developer', 'Independent Civic Developer');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-nira-01', 'NIRA Identity', 'mda-01');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-moh-01', 'MoH Registry', 'mda-06');
db.prepare("INSERT INTO access_requests (id, consumer_mda_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'mda', ?, ?, ?)").run('req-1', 'mda-06', 'api-nira-01', 'Health verification', 'PENDING');
db.prepare("INSERT INTO access_requests (id, consumer_mda_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'mda', ?, ?, ?)").run('req-2', 'mda-01', 'api-moh-01', 'Identity sync', 'PENDING');
db.prepare("INSERT INTO access_requests (id, consumer_user_id, consumer_type, api_id, purpose, status) VALUES (?, ?, 'user', ?, ?, ?)").run('req-public', 'usr-public', 'api-nira-01', 'Civic service', 'PENDING');
db.prepare('INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?)').run('audit-1', 'ACCESS_REQUESTED', 'mda-06', 'api-nira-01', 'req-1', '{}');

const developer = { id: 'usr-dev', role: 'developer' as const, mda_id: 'mda-06' };
const publicDeveloper = { id: 'usr-public', role: 'developer' as const, mda_id: null };
const niraOwner = { id: 'usr-owner', role: 'api_owner' as const, mda_id: 'mda-01' };
const mohOwner = { id: 'usr-owner-2', role: 'api_owner' as const, mda_id: 'mda-06' };
const admin = { id: 'usr-admin', role: 'admin' as const, mda_id: 'mda-05' };
const reviewer = { id: 'usr-reviewer', role: 'reviewer' as const, mda_id: 'mda-05' };

assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-01'), {
  allowed: false,
  code: 'MDA_IMPERSONATION',
  message: 'Access requests must use the approved MDA assigned to your account.',
});
assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-06'), { allowed: true, mdaId: 'mda-06', consumerType: 'mda' });
assert.deepEqual(resolveConsumerMdaForRequest(publicDeveloper, null), { allowed: true, userId: 'usr-public', consumerType: 'user' });
assert.deepEqual(resolveConsumerMdaForRequest(admin, 'mda-01'), { allowed: true, mdaId: 'mda-01', consumerType: 'mda' });
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
assert.equal(listAuditLogs(db)[0].mda_name, 'MoH');
assert.equal(listAuditLogs(db)[0].api_name, 'NIRA Identity');

console.log('access-control tests passed');
