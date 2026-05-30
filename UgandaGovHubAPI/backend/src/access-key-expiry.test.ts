import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { accessRouter } from './routes/access';

const admin = {
  id: 'usr-admin-expiry',
  full_name: 'Expiry Admin',
  email: 'expiry.admin@example.go.ug',
  password_hash: 'unused',
  account_type: 'admin',
  requested_role: 'admin',
  requested_mda_id: 'mda-moict',
  requested_organization: 'MoICT',
  requested_purpose: 'Manage key expiry',
  status: 'APPROVED',
  role: 'admin',
  mda_id: 'mda-moict',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

function createExpiredKeyDb() {
  let expiryUpdateAttempts = 0;
  let auditWrites = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([admin as any]);
      }
      if (normalizedSql.includes('FROM access_requests WHERE id = $1')) {
        assert.deepEqual(params, ['req-expired-key']);
        return result([{
          consumer_mda_id: 'mda-moh',
          consumer_user_id: 'usr-key-owner',
          api_id: 'api-nira-01',
          api_key_hash: 'hash-expired-key',
          api_key_status: 'ACTIVE',
          api_key_revoked_at: null,
          api_key_expires_at: '2020-01-01T00:00:00.000Z',
        }]);
      }
      if (normalizedSql.includes('UPDATE access_requests SET api_key_expires_at')) {
        expiryUpdateAttempts += 1;
        if (normalizedSql.includes('api_key_expires_at IS NULL OR api_key_expires_at >')) {
          return result([], 0);
        }
        return result([], 1);
      }
      if (normalizedSql.includes('information_schema.columns')) {
        return result([{ exists: true }]);
      }
      if (normalizedSql.includes('INSERT INTO audit_logs')) {
        auditWrites += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in expired key expiry regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    expiryUpdateAttempts: () => expiryUpdateAttempts,
    auditWrites: () => auditWrites,
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
  app.use('/api/access', accessRouter(db));

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
  const fake = createExpiredKeyDb();
  const app = await startApp(fake.db);

  try {
    const expiryUpdate = await request(app.baseUrl, '/api/access/req-expired-key/key-expiry', {
      method: 'PATCH',
      headers: { authorization: 'Bearer expired-key-session' },
      body: JSON.stringify({ api_key_expires_at: '2026-12-31T00:00:00.000Z' }),
    });

    assert.equal(expiryUpdate.response.status, 409);
    assert.equal(expiryUpdate.body.code, 'API_KEY_NOT_ACTIVE');
    assert.equal(fake.expiryUpdateAttempts(), 0);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('access key expiry lifecycle tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
