import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { hashPassword, SESSION_COOKIE_NAME } from './auth';
import type { Db } from './db';
import { authRouter } from './routes/auth';

const approvedUser = {
  id: 'usr-mfa-setup',
  full_name: 'MFA Setup User',
  email: 'mfa.setup@example.go.ug',
  password_hash: hashPassword('MfaSetupPass123!'),
  account_type: 'government_employee',
  requested_role: 'developer',
  requested_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  requested_organization: 'Ministry of Health',
  requested_purpose: 'Regression test',
  status: 'APPROVED',
  role: 'developer',
  mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-22T10:00:00.000Z',
  updated_at: '2026-05-22T10:00:00.000Z',
};

function createMfaSetupDb() {
  let secretWrites = 0;

  const db: Db = {
    async query(sql) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [approvedUser as any], rowCount: 1 };
      }
      if (/SELECT \* FROM users WHERE id = \$1/i.test(sql)) {
        return { rows: [approvedUser as any], rowCount: 1 };
      }
      if (/UPDATE users SET mfa_secret_encrypted = \$1/i.test(sql)) {
        secretWrites += 1;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query in MFA setup regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    secretWrites: () => secretWrites,
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
  const fake = createMfaSetupDb();
  const { server, baseUrl } = await startApp(fake.db);

  try {
    const missingPassword = await request(baseUrl, '/api/auth/mfa/setup', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=mfa-setup-session-token`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(missingPassword.response.status, 401);
    assert.equal(missingPassword.body.code, 'INVALID_PASSWORD');
    assert.equal(missingPassword.body.secret, undefined);
    assert.equal(fake.secretWrites(), 0);

    const validPassword = await request(baseUrl, '/api/auth/mfa/setup', {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=mfa-setup-session-token`,
      },
      body: JSON.stringify({ password: 'MfaSetupPass123!' }),
    });

    assert.equal(validPassword.response.status, 200);
    assert.match(validPassword.body.secret, /^[A-Z2-7]+$/);
    assert.equal(typeof validPassword.body.otpauth_url, 'string');
    assert.equal(fake.secretWrites(), 1);
  } finally {
    await close(server);
  }
}

main().then(() => {
  console.log('auth MFA setup tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
