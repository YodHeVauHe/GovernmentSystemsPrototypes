import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { catalogRouter } from './routes/catalog';

const apiOwner = {
  id: 'usr-catalog-register-owner',
  full_name: 'Catalog Register Owner',
  email: 'catalog.register.owner@example.go.ug',
  password_hash: 'unused',
  account_type: 'mda_api_owner',
  requested_role: 'api_owner',
  requested_mda_id: 'mda-old-owner',
  requested_organization: 'Old Owner MDA',
  requested_purpose: 'Register owned APIs',
  status: 'APPROVED',
  role: 'api_owner',
  mda_id: 'mda-old-owner',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

function createStaleCatalogRegistrationDb() {
  let apiInserts = 0;
  let versionInserts = 0;
  let auditWrites = 0;
  let staleActorChecks = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([apiOwner as any]);
      }
      if (normalizedSql.includes('SELECT id FROM mdas WHERE id = $1')) {
        assert.equal(params[0], 'mda-old-owner');
        return result([{ id: 'mda-old-owner' }]);
      }
      if (normalizedSql.includes('FROM users') && normalizedSql.includes('FOR UPDATE')) {
        staleActorChecks += 1;
        assert.deepEqual(params, ['usr-catalog-register-owner', 'api_owner', false, 'mda-old-owner']);
        return result([]);
      }
      if (normalizedSql.includes('INSERT INTO apis')) {
        apiInserts += 1;
        return result([], 1);
      }
      if (normalizedSql.includes('INSERT INTO api_versions')) {
        versionInserts += 1;
        return result([], 1);
      }
      if (normalizedSql.includes('INSERT INTO audit_logs')) {
        auditWrites += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in stale catalog registration regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    apiInserts: () => apiInserts,
    versionInserts: () => versionInserts,
    auditWrites: () => auditWrites,
    staleActorChecks: () => staleActorChecks,
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
  app.use('/api/catalog', catalogRouter(db));

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
  const fake = createStaleCatalogRegistrationDb();
  const app = await startApp(fake.db);

  try {
    const registration = await request(app.baseUrl, '/api/catalog', {
      method: 'POST',
      headers: { authorization: 'Bearer stale-catalog-register-owner-session' },
      body: JSON.stringify({
        name: 'Stale Registration API',
        owning_mda_id: 'mda-old-owner',
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: Stale Registration\n  version: 1.0.0\npaths: {}\n',
      }),
    });

    assert.equal(registration.response.status, 409);
    assert.equal(registration.body.code, 'API_REGISTRATION_STALE');
    assert.equal(fake.staleActorChecks(), 1);
    assert.equal(fake.apiInserts(), 0);
    assert.equal(fake.versionInserts(), 0);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('catalog registration race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
