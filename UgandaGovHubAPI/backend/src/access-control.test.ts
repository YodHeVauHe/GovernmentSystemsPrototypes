import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  buildAccessRequestList,
  canManageApi,
  canReviewAccessRequest,
  listAuditLogs,
  resolveConsumerMdaForRequest,
} from './access-control';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE mdas (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_name TEXT NOT NULL);
  CREATE TABLE apis (id TEXT PRIMARY KEY, name TEXT NOT NULL, owning_mda_id TEXT NOT NULL);
  CREATE TABLE access_requests (
    id TEXT PRIMARY KEY,
    consumer_mda_id TEXT NOT NULL,
    api_id TEXT NOT NULL,
    purpose TEXT,
    status TEXT,
    api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    mda_id TEXT,
    api_id TEXT,
    request_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-01', 'NIRA', 'NIRA');
db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?)').run('mda-06', 'MoH', 'MoH');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-nira-01', 'NIRA Identity', 'mda-01');
db.prepare('INSERT INTO apis (id, name, owning_mda_id) VALUES (?, ?, ?)').run('api-moh-01', 'MoH Registry', 'mda-06');
db.prepare('INSERT INTO access_requests (id, consumer_mda_id, api_id, purpose, status) VALUES (?, ?, ?, ?, ?)').run('req-1', 'mda-06', 'api-nira-01', 'Health verification', 'PENDING');
db.prepare('INSERT INTO access_requests (id, consumer_mda_id, api_id, purpose, status) VALUES (?, ?, ?, ?, ?)').run('req-2', 'mda-01', 'api-moh-01', 'Identity sync', 'PENDING');
db.prepare('INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?)').run('audit-1', 'ACCESS_REQUESTED', 'mda-06', 'api-nira-01', 'req-1', '{}');

const developer = { id: 'usr-dev', role: 'developer' as const, mda_id: 'mda-06' };
const niraOwner = { id: 'usr-owner', role: 'api_owner' as const, mda_id: 'mda-01' };
const mohOwner = { id: 'usr-owner-2', role: 'api_owner' as const, mda_id: 'mda-06' };
const admin = { id: 'usr-admin', role: 'admin' as const, mda_id: 'mda-05' };
const reviewer = { id: 'usr-reviewer', role: 'reviewer' as const, mda_id: 'mda-05' };

assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-01'), {
  allowed: false,
  code: 'MDA_IMPERSONATION',
  message: 'Access requests must use the approved MDA assigned to your account.',
});
assert.deepEqual(resolveConsumerMdaForRequest(developer, 'mda-06'), { allowed: true, mdaId: 'mda-06' });
assert.deepEqual(resolveConsumerMdaForRequest(admin, 'mda-01'), { allowed: true, mdaId: 'mda-01' });

assert.deepEqual(buildAccessRequestList(db, developer).map((request: any) => request.id), ['req-1']);
assert.deepEqual(buildAccessRequestList(db, niraOwner).map((request: any) => request.id), ['req-1']);
assert.deepEqual(buildAccessRequestList(db, mohOwner).map((request: any) => request.id), ['req-2']);
assert.equal(buildAccessRequestList(db, admin).length, 2);
assert.equal(buildAccessRequestList(db, reviewer).length, 2);

assert.equal(canReviewAccessRequest(db, admin, 'req-1').allowed, true);
assert.equal(canReviewAccessRequest(db, niraOwner, 'req-1').allowed, true);
assert.equal(canReviewAccessRequest(db, mohOwner, 'req-1').allowed, false);
assert.equal(canReviewAccessRequest(db, reviewer, 'req-1').allowed, false);

assert.equal(canManageApi(db, admin, 'api-nira-01').allowed, true);
assert.equal(canManageApi(db, niraOwner, 'api-nira-01').allowed, true);
assert.equal(canManageApi(db, mohOwner, 'api-nira-01').allowed, false);
assert.equal(listAuditLogs(db)[0].mda_name, 'MoH');
assert.equal(listAuditLogs(db)[0].api_name, 'NIRA Identity');

console.log('access-control tests passed');
