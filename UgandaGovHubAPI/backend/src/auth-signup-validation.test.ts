import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { authRouter } from './routes/auth';

type InsertedUser = Record<string, any> | null;

function createSignupValidationDb() {
  let insertAttempts = 0;
  let insertedUser: InsertedUser = null;

  const db = {
    async query(sql, params = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT * FROM users WHERE email = $1') {
        return { rows: [], rowCount: 0 };
      }
      if (normalizedSql.includes('INSERT INTO users')) {
        insertAttempts += 1;
        insertedUser = {
          id: params[0],
          full_name: params[1],
          email: params[2],
          password_hash: params[3],
          account_type: params[4],
          requested_role: params[5],
          requested_mda_id: params[6],
          requested_organization: params[7],
          requested_purpose: params[8],
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
        return { rows: [], rowCount: 1 };
      }
      if (normalizedSql.includes('INSERT INTO user_profiles')) {
        return { rows: [], rowCount: 1 };
      }
      if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
        return { rows: insertedUser ? [insertedUser] : [], rowCount: insertedUser ? 1 : 0 };
      }
      throw new Error(`Unexpected query in auth signup validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  } as Db;

  return {
    db,
    insertAttempts: () => insertAttempts,
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
  delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;

  const fake = createSignupValidationDb();
  const { server, baseUrl } = await startApp(fake.db);

  try {
    const malformedSignup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Malformed MDA',
        email: 'malformed.mda@example.go.ug',
        password: 'StrongPass123!',
        account_type: 'government',
        requested_role: 'developer',
        requested_mda_id: { id: 'mda-moh' },
        requested_organization: 'Ministry of Health',
        requested_purpose: 'Validate malformed MDA handling',
      }),
    });

    assert.equal(malformedSignup.response.status, 400);
    assert.match(malformedSignup.body.error, /requested_mda_id/);
    assert.equal(fake.insertAttempts(), 0);
  } finally {
    await close(server);
  }
}

main().then(() => {
  console.log('auth signup validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
