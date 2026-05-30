import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { catalogVersionsRouter } from './routes/catalog-versions';

const adminUser = {
  id: 'usr-version-validation-admin',
  full_name: 'Version Validation Admin',
  email: 'version.validation.admin@example.go.ug',
  password_hash: 'unused',
  account_type: 'government_employee',
  requested_role: 'admin',
  requested_mda_id: 'mda-moict',
  requested_organization: 'MoICT',
  requested_purpose: 'Validate API versions',
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

function createCatalogVersionValidationDb() {
  let apiVersionInserts = 0;
  let versionCurrentClears = 0;
  let apiSpecUpdates = 0;
  let auditWrites = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([adminUser as any]);
      }
      if (normalizedSql === 'SELECT id FROM apis WHERE id = $1') {
        assert.deepEqual(params, ['api-version-validation']);
        return result([{ id: 'api-version-validation' }]);
      }
      if (normalizedSql.includes('SELECT id FROM api_versions WHERE api_id = $1 AND (version = $2 OR id = $3)')) {
        assert.deepEqual(params, ['api-version-validation', '2.0.0', 'api-version-validation-2-0-0']);
        return result([]);
      }
      if (normalizedSql === 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1') {
        versionCurrentClears += 1;
        return result([], 1);
      }
      if (normalizedSql === 'UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3') {
        apiSpecUpdates += 1;
        return result([], 1);
      }
      if (normalizedSql.includes('INSERT INTO api_versions')) {
        apiVersionInserts += 1;
        return result([], 1);
      }
      if (normalizedSql.includes('INSERT INTO audit_logs')) {
        auditWrites += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in catalog version validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    apiVersionInserts: () => apiVersionInserts,
    versionCurrentClears: () => versionCurrentClears,
    apiSpecUpdates: () => apiSpecUpdates,
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
  app.use('/api/catalog/:id/versions', catalogVersionsRouter(db, async () => ({ allowed: true, visibility: 'public' as const })));

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
  const fake = createCatalogVersionValidationDb();
  const app = await startApp(fake.db);

  try {
    const publish = await request(app.baseUrl, '/api/catalog/api-version-validation/versions', {
      method: 'POST',
      headers: { authorization: 'Bearer catalog-version-validation-session' },
      body: JSON.stringify({
        make_current: 'false',
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: Version Validation\n  version: 2.0.0\npaths: {}\n',
      }),
    });

    assert.equal(publish.response.status, 400);
    assert.match(publish.body.error, /make_current/i);
    assert.equal(fake.versionCurrentClears(), 0);
    assert.equal(fake.apiSpecUpdates(), 0);
    assert.equal(fake.apiVersionInserts(), 0);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(app.server);
  }

  const malformedStatusFake = createCatalogVersionValidationDb();
  const malformedStatusApp = await startApp(malformedStatusFake.db);
  try {
    const malformedStatus = await request(malformedStatusApp.baseUrl, '/api/catalog/api-version-validation/versions', {
      method: 'POST',
      headers: { authorization: 'Bearer catalog-version-validation-session' },
      body: JSON.stringify({
        status: ['Published'],
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: Version Validation\n  version: 2.0.0\npaths: {}\n',
      }),
    });

    assert.equal(malformedStatus.response.status, 400);
    assert.match(malformedStatus.body.error, /status/i);
    assert.equal(malformedStatusFake.versionCurrentClears(), 0);
    assert.equal(malformedStatusFake.apiSpecUpdates(), 0);
    assert.equal(malformedStatusFake.apiVersionInserts(), 0);
    assert.equal(malformedStatusFake.auditWrites(), 0);
  } finally {
    await close(malformedStatusApp.server);
  }

  const oversizedNotesFake = createCatalogVersionValidationDb();
  const oversizedNotesApp = await startApp(oversizedNotesFake.db);
  try {
    const oversizedNotes = await request(oversizedNotesApp.baseUrl, '/api/catalog/api-version-validation/versions', {
      method: 'POST',
      headers: { authorization: 'Bearer catalog-version-validation-session' },
      body: JSON.stringify({
        notes: 'x'.repeat(2001),
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: Version Validation\n  version: 2.0.0\npaths: {}\n',
      }),
    });

    assert.equal(oversizedNotes.response.status, 400);
    assert.match(oversizedNotes.body.error, /notes/i);
    assert.equal(oversizedNotesFake.versionCurrentClears(), 0);
    assert.equal(oversizedNotesFake.apiSpecUpdates(), 0);
    assert.equal(oversizedNotesFake.apiVersionInserts(), 0);
    assert.equal(oversizedNotesFake.auditWrites(), 0);
  } finally {
    await close(oversizedNotesApp.server);
  }
}

main().then(() => {
  console.log('catalog version validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
