import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { accessRouter } from './routes/access';

const approvedDeveloper = {
  id: 'usr-access-race',
  full_name: 'Access Race Developer',
  email: 'access.race@example.go.ug',
  password_hash: 'unused',
  account_type: 'government_employee',
  requested_role: 'developer',
  requested_mda_id: 'mda-moh',
  requested_organization: 'Ministry of Health',
  requested_purpose: 'Request API access',
  status: 'APPROVED',
  role: 'developer',
  mda_id: 'mda-moh',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

function createDuplicateRaceDb() {
  let blockingLookups = 0;
  let insertAttempts = 0;
  let auditWrites = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([approvedDeveloper as any]);
      }
      if (normalizedSql === 'SELECT id FROM apis WHERE id = $1') {
        assert.deepEqual(params, ['api-nira-01']);
        return result([{ id: 'api-nira-01' }]);
      }
      if (normalizedSql === 'SELECT id FROM mdas WHERE id = $1') {
        assert.deepEqual(params, ['mda-moh']);
        return result([{ id: 'mda-moh' }]);
      }
      if (normalizedSql.includes('SELECT id, status, api_key_status FROM access_requests')) {
        blockingLookups += 1;
        assert.equal(params[0], 'api-nira-01');
        assert.equal(params[1], 'mda-moh');
        if (blockingLookups === 1) return result([]);
        return result([{ id: 'req-existing-race', status: 'PENDING', api_key_status: null }]);
      }
      if (normalizedSql.includes('INSERT INTO access_requests')) {
        insertAttempts += 1;
        assert.equal(params[1], 'mda-moh');
        assert.equal(params[4], 'api-nira-01');
        if (normalizedSql.includes('NOT EXISTS')) {
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

      throw new Error(`Unexpected SQL in duplicate access request race test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    blockingLookups: () => blockingLookups,
    insertAttempts: () => insertAttempts,
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
  const fake = createDuplicateRaceDb();
  const app = await startApp(fake.db);

  try {
    const duplicateRequest = await request(app.baseUrl, '/api/access', {
      method: 'POST',
      headers: { authorization: 'Bearer access-race-session' },
      body: JSON.stringify({
        api_id: 'api-nira-01',
        purpose: 'Duplicate access request race',
      }),
    });

    assert.equal(duplicateRequest.response.status, 409);
    assert.equal(duplicateRequest.body.code, 'ACCESS_REQUEST_ALREADY_EXISTS');
    assert.equal(duplicateRequest.body.existing_request_id, 'req-existing-race');
    assert.equal(fake.blockingLookups(), 2);
    assert.equal(fake.insertAttempts(), 1);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('access request race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
