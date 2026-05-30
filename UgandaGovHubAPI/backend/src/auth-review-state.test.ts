import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { adminUsersRouter } from './routes/auth';

type ReviewScenario = 'reject-approved' | 'stale-needs-info';
type TestUser = Record<string, any>;
type TestProfile = Record<string, any>;

function user(overrides: Partial<TestUser>): TestUser {
  return {
    id: 'usr-review-target',
    full_name: 'Review Target',
    email: 'review.target@example.go.ug',
    password_hash: 'hash',
    account_type: 'government_employee',
    requested_role: 'developer',
    requested_mda_id: 'mda-test',
    requested_organization: 'Ministry Test',
    requested_purpose: 'Integrate test workflows',
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
    user_id: 'usr-review-target',
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
    job_title: 'Developer',
    supervisor_name: 'Supervisor',
    supervisor_email: 'supervisor@example.go.ug',
    review_notes: null,
    submitted_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function createReviewDb(scenario: ReviewScenario) {
  const admin = user({
    id: 'usr-admin',
    email: 'admin@example.go.ug',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-test',
    account_type: 'admin',
    requested_role: 'admin',
  });
  const target = scenario === 'reject-approved'
    ? user({ status: 'APPROVED', role: 'developer', mda_id: 'mda-test' })
    : user({});
  const targetProfile = scenario === 'reject-approved'
    ? profile({ verification_status: 'verified' })
    : profile({});

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  function finalizeTargetAsApproved() {
    target.status = 'APPROVED';
    target.role = 'developer';
    target.mda_id = 'mda-test';
    targetProfile.verification_status = 'verified';
    targetProfile.review_notes = null;
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
        return result([admin, target].filter(row => row.id === id));
      }
      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
        return result([], 0);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'verified'")) {
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM user_profiles WHERE user_id = $1')) {
        return result(params[0] === target.id ? [targetProfile] : []);
      }
      if (normalizedSql.includes('SELECT * FROM verification_documents WHERE user_id = $1')) {
        return result([]);
      }
      if (normalizedSql.includes('information_schema.tables')) {
        return result([{ exists: false }]);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'needs_more_information'")) {
        if (scenario === 'stale-needs-info') {
          finalizeTargetAsApproved();
        }
        if (
          normalizedSql.includes("AND verification_status = 'submitted_for_review'") &&
          targetProfile.verification_status !== 'submitted_for_review'
        ) {
          return result([], 0);
        }
        targetProfile.verification_status = 'needs_more_information';
        targetProfile.review_notes = params[0];
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE users SET status = 'REJECTED'")) {
        target.status = 'REJECTED';
        target.role = null;
        target.mda_id = null;
        target.reviewed_by = params[0];
        target.reviewed_at = params[1];
        target.rejection_reason = params[2];
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'rejected'")) {
        targetProfile.verification_status = 'rejected';
        targetProfile.review_notes = params[0];
        return result([], 1);
      }
      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return { db, target, targetProfile };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function withApp<T>(db: Db, callback: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', adminUsersRouter(db));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

async function main() {
  const rejectFixture = createReviewDb('reject-approved');
  await withApp(rejectFixture.db, async baseUrl => {
    const rejected = await request(baseUrl, '/api/admin/users/usr-review-target/reject', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-session' },
      body: JSON.stringify({ reason: 'No longer valid.' }),
    });

    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.body.code, 'VERIFICATION_NOT_SUBMITTED');
    assert.equal(rejectFixture.target.status, 'APPROVED');
    assert.equal(rejectFixture.target.role, 'developer');
    assert.equal(rejectFixture.targetProfile.verification_status, 'verified');
  });

  const staleNeedsInfoFixture = createReviewDb('stale-needs-info');
  await withApp(staleNeedsInfoFixture.db, async baseUrl => {
    const needsInfo = await request(baseUrl, '/api/admin/users/usr-review-target/needs-more-information', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-session' },
      body: JSON.stringify({ notes: 'Upload a clearer appointment letter.' }),
    });

    assert.equal(needsInfo.response.status, 409);
    assert.equal(needsInfo.body.code, 'VERIFICATION_ALREADY_FINALIZED');
    assert.equal(staleNeedsInfoFixture.target.status, 'APPROVED');
    assert.equal(staleNeedsInfoFixture.target.role, 'developer');
    assert.equal(staleNeedsInfoFixture.targetProfile.verification_status, 'verified');
  });
}

main().then(() => {
  console.log('auth review state tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
