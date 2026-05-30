import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { adminUsersRouter } from './routes/auth';
import type { Db } from './db';

type TestUser = Record<string, any>;
type TestProfile = Record<string, any>;

function user(overrides: Partial<TestUser>): TestUser {
  return {
    id: 'usr-candidate',
    full_name: 'Approval Candidate',
    email: 'candidate@example.go.ug',
    password_hash: 'hash',
    account_type: 'government_employee',
    requested_role: 'reviewer',
    requested_mda_id: 'mda-test',
    requested_organization: 'Ministry Test',
    requested_purpose: 'Review access workflows',
    status: 'PENDING_REVIEW',
    role: null,
    mda_id: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function profile(overrides: Partial<TestProfile>): TestProfile {
  return {
    user_id: 'usr-candidate',
    verification_status: 'submitted_for_review',
    account_category: 'government_employee',
    nin: null,
    national_id_number: null,
    contact_phone: null,
    address: null,
    organization_name: 'Ministry Test',
    organization_type: null,
    ursb_number: null,
    brn: null,
    tin: null,
    staff_id: 'STAFF-1',
    department: 'Security',
    job_title: 'Reviewer',
    supervisor_name: 'Supervisor',
    supervisor_email: 'supervisor@example.go.ug',
    review_notes: null,
    submitted_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function createStaleApprovalDb() {
  const admin = user({
    id: 'usr-admin',
    email: 'admin@example.go.ug',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-test',
    account_type: 'admin',
    requested_role: 'admin',
  });
  const candidate = user({});
  const candidateProfile = profile({});
  let transactionStarted = false;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([admin]);
      }
      if (normalizedSql === 'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE') {
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
        const id = params[0];
        return result([admin, candidate].filter(row => row.id === id));
      }
      if (normalizedSql.includes('SELECT id FROM mdas WHERE id = $1')) {
        return params[0] === 'mda-test'
          ? result([{ id: 'mda-test' }])
          : result([]);
      }
      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM user_profiles WHERE user_id = $1')) {
        return result(params[0] === candidate.id ? [candidateProfile] : []);
      }
      if (normalizedSql.includes('SELECT * FROM verification_documents WHERE user_id = $1')) {
        return result([]);
      }
      if (normalizedSql.includes("UPDATE users SET status = 'APPROVED'")) {
        if (normalizedSql.includes("AND status = 'PENDING_REVIEW'") && candidate.status !== 'PENDING_REVIEW') {
          return result([], 0);
        }
        candidate.status = 'APPROVED';
        candidate.role = params[0];
        candidate.mda_id = params[1];
        candidate.reviewed_by = params[2];
        candidate.reviewed_at = params[3];
        candidate.rejection_reason = null;
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'verified'")) {
        if (
          normalizedSql.includes("AND verification_status = 'submitted_for_review'") &&
          candidateProfile.verification_status !== 'submitted_for_review'
        ) {
          return result([], 0);
        }
        candidateProfile.verification_status = 'verified';
        candidateProfile.account_category = params[0];
        candidateProfile.review_notes = null;
        return result([], 1);
      }
      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      transactionStarted = true;
      candidate.status = 'REJECTED';
      candidate.rejection_reason = 'Rejected by another administrator.';
      candidateProfile.verification_status = 'rejected';
      candidateProfile.review_notes = 'Rejected by another administrator.';
      return callback(db);
    },
    async close() {},
  } as Db;

  return { db, candidate, candidateProfile, get transactionStarted() { return transactionStarted; } };
}

function createStaleApproverDb() {
  const admin = user({
    id: 'usr-stale-approver',
    email: 'stale.approver@example.go.ug',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-test',
    account_type: 'admin',
    requested_role: 'admin',
  });
  const candidate = user({
    id: 'usr-stale-approver-candidate',
    email: 'stale.approver.candidate@example.go.ug',
  });
  const candidateProfile = profile({ user_id: candidate.id });
  let transactionStarted = false;
  let userTableLocked = false;
  let userUpdates = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([admin]);
      }
      if (normalizedSql === 'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE') {
        userTableLocked = true;
        admin.status = 'SUSPENDED';
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
        const id = params[0];
        return result([admin, candidate].filter(row => row.id === id));
      }
      if (normalizedSql.includes('SELECT id FROM mdas WHERE id = $1')) {
        return params[0] === 'mda-test'
          ? result([{ id: 'mda-test' }])
          : result([]);
      }
      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM user_profiles WHERE user_id = $1')) {
        return result(params[0] === candidate.id ? [candidateProfile] : []);
      }
      if (normalizedSql.includes('SELECT * FROM verification_documents WHERE user_id = $1')) {
        return result([]);
      }
      if (normalizedSql.includes("UPDATE users SET status = 'APPROVED'")) {
        userUpdates += 1;
        candidate.status = 'APPROVED';
        candidate.role = params[0];
        candidate.mda_id = params[1];
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'verified'")) {
        candidateProfile.verification_status = 'verified';
        candidateProfile.account_category = params[0];
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in stale approver regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      transactionStarted = true;
      admin.status = 'SUSPENDED';
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    admin,
    candidate,
    candidateProfile,
    userUpdates: () => userUpdates,
    wasUserTableLocked: () => userTableLocked,
    get transactionStarted() { return transactionStarted; },
  };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main() {
  const fixture = createStaleApprovalDb();
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', adminUsersRouter(fixture.db));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const approval = await request(baseUrl, '/api/admin/users/usr-candidate/approve', {
      method: 'POST',
      headers: { authorization: 'Bearer stale-admin-session' },
      body: JSON.stringify({ role: 'reviewer', mda_id: 'mda-test' }),
    });

    assert.equal(fixture.transactionStarted, true);
    assert.equal(approval.response.status, 409);
    assert.equal(approval.body.code, 'VERIFICATION_ALREADY_FINALIZED');
    assert.equal(fixture.candidate.status, 'REJECTED');
    assert.equal(fixture.candidate.role, null);
    assert.equal(fixture.candidateProfile.verification_status, 'rejected');
  } finally {
    await close(server);
  }

  const staleApprover = createStaleApproverDb();
  const staleApproverApp = express();
  staleApproverApp.use(express.json());
  staleApproverApp.use('/api/admin/users', adminUsersRouter(staleApprover.db));
  const staleApproverServer = createServer(staleApproverApp);
  await new Promise<void>(resolve => staleApproverServer.listen(0, '127.0.0.1', resolve));
  const staleApproverAddress = staleApproverServer.address();
  assert(staleApproverAddress && typeof staleApproverAddress === 'object');
  const staleApproverBaseUrl = `http://127.0.0.1:${staleApproverAddress.port}`;

  try {
    const approval = await request(staleApproverBaseUrl, '/api/admin/users/usr-stale-approver-candidate/approve', {
      method: 'POST',
      headers: { authorization: 'Bearer stale-approver-session' },
      body: JSON.stringify({ role: 'reviewer', mda_id: 'mda-test' }),
    });

    assert.equal(staleApprover.transactionStarted, true);
    assert.equal(approval.response.status, 403);
    assert.equal(approval.body.code, 'FORBIDDEN');
    assert.equal(staleApprover.wasUserTableLocked(), true);
    assert.equal(staleApprover.userUpdates(), 0);
    assert.equal(staleApprover.candidate.status, 'PENDING_REVIEW');
    assert.equal(staleApprover.candidateProfile.verification_status, 'submitted_for_review');
  } finally {
    await close(staleApproverServer);
  }
}

main().then(() => {
  console.log('auth approval race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
