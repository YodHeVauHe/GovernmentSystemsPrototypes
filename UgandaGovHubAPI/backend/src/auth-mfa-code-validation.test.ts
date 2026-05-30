import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { getTotpCode, hashPassword, SESSION_COOKIE_NAME } from './auth';
import type { Db } from './db';
import { authRouter } from './routes/auth';

const mfaSecret = 'JBSWY3DPEHPK3PXP';

const approvedUser = {
  id: 'usr-mfa-code-validation',
  full_name: 'MFA Code Validation User',
  email: 'mfa.code.validation@example.go.ug',
  password_hash: hashPassword('MfaCodePass123!'),
  account_type: 'government_employee',
  requested_role: 'developer',
  requested_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  requested_organization: 'Ministry of Health',
  requested_purpose: 'Validate MFA codes',
  status: 'APPROVED',
  role: 'developer',
  mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: mfaSecret,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

function createMfaCodeValidationDb() {
  let enableAttempts = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([approvedUser as any]);
      }
      if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
        return result([approvedUser as any]);
      }
      if (normalizedSql.includes('UPDATE users SET mfa_enabled_at = $1')) {
        enableAttempts += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in MFA code validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    enableAttempts: () => enableAttempts,
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
  const fake = createMfaCodeValidationDb();
  const app = await startApp(fake.db);

  try {
    const code = getTotpCode(mfaSecret);
    const enableMfa = await request(app.baseUrl, '/api/auth/mfa/enable', {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=mfa-code-validation-session` },
      body: JSON.stringify({ code: [code] }),
    });

    assert.equal(enableMfa.response.status, 400);
    assert.equal(enableMfa.body.code, 'INVALID_MFA_CODE');
    assert.equal(fake.enableAttempts(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('auth MFA code validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
