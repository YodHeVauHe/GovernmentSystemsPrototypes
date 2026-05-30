import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { adminUsersRouter } from './routes/auth';

type ReviewAction = 'needs-more-information' | 'reject';
type TestUser = Record<string, any>;
type TestProfile = Record<string, any>;

function user(overrides: Partial<TestUser>): TestUser {
  return {
    id: 'usr-review-actor-target',
    full_name: 'Review Actor Target',
    email: 'review.actor.target@example.go.ug',
    password_hash: 'hash',
    account_type: 'government_employee',
    requested_role: 'developer',
    requested_mda_id: 'mda-test',
    requested_organization: 'Ministry Test',
    requested_purpose: 'Integrate review workflows',
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

function profile(): TestProfile {
  return {
    user_id: 'usr-review-actor-target',
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
  };
}

function createStaleReviewActorDb() {
  const admin = user({
    id: 'usr-stale-review-admin',
    email: 'stale.review.admin@example.go.ug',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-test',
    account_type: 'admin',
    requested_role: 'admin',
  });
  const target = user({});
  const targetProfile = profile();
  let userTableLocked = false;
  let updateAttempts = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  function rowsForUser(id: unknown) {
    if (id === admin.id) return [admin];
    if (id === target.id) return [target];
    return [];
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
        return result(rowsForUser(params[0]));
      }
      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
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
        updateAttempts += 1;
        targetProfile.verification_status = 'needs_more_information';
        targetProfile.review_notes = params[0];
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE users SET status = 'REJECTED'")) {
        updateAttempts += 1;
        target.status = 'REJECTED';
        target.role = null;
        target.mda_id = null;
        target.reviewed_by = params[0];
        target.reviewed_at = params[1];
        target.rejection_reason = params[2];
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'rejected'")) {
        updateAttempts += 1;
        targetProfile.verification_status = 'rejected';
        targetProfile.review_notes = params[0];
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in stale review actor regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    target,
    targetProfile,
    updateAttempts: () => updateAttempts,
    wasUserTableLocked: () => userTableLocked,
  };
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
    await close(server);
  }
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function assertStaleReviewActorCannotMutate(action: ReviewAction) {
  const fixture = createStaleReviewActorDb();
  const path = `/api/admin/users/usr-review-actor-target/${action}`;
  const body = action === 'reject'
    ? { reason: 'Insufficient evidence.' }
    : { notes: 'Upload a clearer appointment letter.' };

  await withApp(fixture.db, async baseUrl => {
    const review = await request(baseUrl, path, {
      method: 'POST',
      headers: { authorization: 'Bearer stale-review-admin-session' },
      body: JSON.stringify(body),
    });

    assert.equal(review.response.status, 403);
    assert.equal(review.body.code, 'FORBIDDEN');
    assert.equal(fixture.wasUserTableLocked(), true);
    assert.equal(fixture.updateAttempts(), 0);
    assert.equal(fixture.target.status, 'PENDING_REVIEW');
    assert.equal(fixture.targetProfile.verification_status, 'submitted_for_review');
  });
}

async function main() {
  await assertStaleReviewActorCannotMutate('needs-more-information');
  await assertStaleReviewActorCannotMutate('reject');
}

main().then(() => {
  console.log('auth review actor race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
