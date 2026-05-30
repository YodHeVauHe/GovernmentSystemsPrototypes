import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { hashPassword, SESSION_COOKIE_NAME } from './auth';
import type { Db } from './db';
import { authRouter } from './routes/auth';

const draftUser = {
  id: 'usr-profile-validation',
  full_name: 'Profile Validation User',
  email: 'profile.validation@example.go.ug',
  password_hash: hashPassword('ProfilePass123!'),
  account_type: 'public_developer',
  requested_role: 'developer',
  requested_mda_id: null,
  requested_organization: 'Independent Civic Developer',
  requested_purpose: 'Regression test',
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

const draftProfile = {
  user_id: draftUser.id,
  verification_status: 'draft_profile',
  account_category: 'public_developer',
  nin: null,
  national_id_number: null,
  contact_phone: null,
  address: null,
  organization_name: 'Independent Civic Developer',
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

function createProfileValidationDb() {
  let profileUpdateAttempts = 0;

  const db: Db = {
    async query(sql) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return { rows: [draftUser as any], rowCount: 1 };
      }
      if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
        return { rows: [draftUser as any], rowCount: 1 };
      }
      if (normalizedSql.includes('INSERT INTO user_profiles')) {
        return { rows: [], rowCount: 0 };
      }
      if (normalizedSql === 'SELECT * FROM user_profiles WHERE user_id = $1') {
        return { rows: [draftProfile as any], rowCount: 1 };
      }
      if (normalizedSql.includes('FROM verification_documents')) {
        return { rows: [], rowCount: 0 };
      }
      if (normalizedSql.startsWith('UPDATE user_profiles SET')) {
        profileUpdateAttempts += 1;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query in auth profile validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
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
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
  });

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
  const fake = createProfileValidationDb();
  const { server, baseUrl } = await startApp(fake.db);

  try {
    const malformedProfile = await request(baseUrl, '/api/auth/account/profile', {
      method: 'PATCH',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=profile-validation-session-token`,
      },
      body: JSON.stringify({
        nin: { value: 'CM123456789012' },
      }),
    });

    assert.equal(malformedProfile.response.status, 400);
    assert.equal(malformedProfile.body.code, 'INVALID_PROFILE_FIELD');
    assert.equal(fake.profileUpdateAttempts(), 0);
  } finally {
    await close(server);
  }
}

main().then(() => {
  console.log('auth profile validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
