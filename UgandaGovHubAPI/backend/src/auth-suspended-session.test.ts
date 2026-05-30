import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { hashPassword, SESSION_COOKIE_NAME } from './auth';
import type { Db } from './db';
import { authRouter } from './routes/auth';

const suspendedUser = {
  id: 'usr-suspended-session',
  full_name: 'Suspended Developer',
  email: 'suspended.session@example.go.ug',
  password_hash: hashPassword('SuspendedPass123!'),
  account_type: 'government_employee',
  requested_role: 'developer',
  requested_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  requested_organization: 'Ministry of Health',
  requested_purpose: 'Regression test',
  status: 'SUSPENDED',
  role: 'developer',
  mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  reviewed_by: 'usr-admin',
  reviewed_at: '2026-05-22T10:00:00.000Z',
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-22T10:00:00.000Z',
  updated_at: '2026-05-22T10:00:00.000Z',
};

function createSuspendedSessionDb() {
  let sessionInserts = 0;

  const db: Db = {
    async query(sql) {
      if (/INSERT INTO rate_limits/i.test(sql)) {
        return { rows: [{ count: 1, reset_at: '2026-06-01T00:00:00.000Z' } as any], rowCount: 1 };
      }
      if (/SELECT \* FROM users WHERE email = \$1/i.test(sql)) {
        return { rows: [suspendedUser as any], rowCount: 1 };
      }
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [suspendedUser as any], rowCount: 1 };
      }
      if (/DELETE FROM rate_limits/i.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/INSERT INTO sessions/i.test(sql)) {
        sessionInserts += 1;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected query in suspended session regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    sessionInserts: () => sessionInserts,
  };
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
  const fake = createSuspendedSessionDb();
  const { server, baseUrl } = await startApp(fake.db);

  try {
    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=suspended-session-token`,
      },
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 403);
    assert.equal(meBody.code, 'ACCOUNT_SUSPENDED');
    assert.equal(meBody.user, undefined);

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: suspendedUser.email,
        password: 'SuspendedPass123!',
      }),
    });
    const loginBody = await loginResponse.json();

    assert.equal(loginResponse.status, 403);
    assert.equal(loginBody.code, 'ACCOUNT_SUSPENDED');
    assert.equal(loginBody.user, undefined);
    assert.equal(fake.sessionInserts(), 0);
  } finally {
    await close(server);
  }
}

main().then(() => {
  console.log('auth suspended session tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
