import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { authRouter } from './routes/auth';

const applicant = {
  id: 'usr-account-race',
  full_name: 'Account Race Applicant',
  email: 'account.race@example.com',
  password_hash: 'unused',
  account_type: 'public_developer',
  requested_role: 'developer',
  requested_mda_id: null,
  requested_organization: 'Independent Developer',
  requested_purpose: 'Build integrations',
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
};

function createClosedProfileRaceDb() {
  const profile: Record<string, any> = {
    user_id: applicant.id,
    verification_status: 'draft_profile',
    account_category: 'public_developer',
    nin: 'CM123456789ABCD',
    national_id_number: '000000001',
    contact_phone: '+256700000000',
    address: 'Kampala',
    organization_name: 'Independent Developer',
    organization_type: null,
    ursb_number: null,
    brn: null,
    tin: null,
    staff_id: null,
    department: null,
    job_title: null,
    supervisor_name: null,
    supervisor_email: null,
    review_notes: null,
    submitted_at: null,
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
  };
  let profileUpdateAttempts = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([applicant as any]);
      }
      if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
        return result(params[0] === applicant.id ? [applicant as any] : []);
      }
      if (normalizedSql.startsWith('INSERT INTO user_profiles')) {
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM user_profiles WHERE user_id = $1')) {
        return result(params[0] === applicant.id ? [profile] : []);
      }
      if (normalizedSql.includes('SELECT * FROM verification_documents WHERE user_id = $1')) {
        return result([]);
      }
      if (normalizedSql.includes('SELECT verification_status FROM user_profiles')) {
        profile.verification_status = 'rejected';
        profile.review_notes = 'Application rejected during edit.';
        return result([{ verification_status: profile.verification_status }]);
      }
      if (normalizedSql.startsWith('UPDATE user_profiles SET account_category')) {
        profileUpdateAttempts += 1;
        profile.verification_status = 'rejected';
        profile.review_notes = 'Application rejected during edit.';
        if (normalizedSql.includes("verification_status NOT IN ('rejected', 'suspended')")) {
          return result([], 0);
        }
        profile.contact_phone = String(params[3]);
        profile.verification_status = 'draft_profile';
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in account mutation race test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    profile,
    profileUpdateAttempts: () => profileUpdateAttempts,
  };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function startApp(db: Db) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(db));

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main() {
  const fake = createClosedProfileRaceDb();
  const app = await startApp(fake.db);

  try {
    const editProfile = await request(app.baseUrl, '/api/auth/account/profile', {
      method: 'PATCH',
      headers: { authorization: 'Bearer account-race-session' },
      body: JSON.stringify({ contact_phone: '+256711111111' }),
    });

    assert.equal(editProfile.response.status, 409);
    assert.equal(editProfile.body.code, 'VERIFICATION_STATE_CHANGED');
    assert.equal(fake.profile.verification_status, 'rejected');
    assert.equal(fake.profile.contact_phone, '+256700000000');
    assert.equal(fake.profileUpdateAttempts(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('auth account mutation race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
