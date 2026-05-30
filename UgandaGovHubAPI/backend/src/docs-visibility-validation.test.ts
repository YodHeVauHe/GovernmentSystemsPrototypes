import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { docsRouter } from './routes/docs';

const adminUser = {
  id: 'usr-docs-validation-admin',
  full_name: 'Docs Validation Admin',
  email: 'docs.validation.admin@example.go.ug',
  password_hash: 'unused',
  account_type: 'government_employee',
  requested_role: 'admin',
  requested_mda_id: 'mda-moict',
  requested_organization: 'MoICT',
  requested_purpose: 'Manage docs visibility',
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

function createDocsVisibilityValidationDb() {
  let updateAttempts = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([adminUser as any]);
      }
      if (normalizedSql.startsWith('UPDATE apis SET docs_visibility = $1 WHERE id = $2')) {
        updateAttempts += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in docs visibility validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    updateAttempts: () => updateAttempts,
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
  app.use('/api/docs', docsRouter(db));

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
  const fake = createDocsVisibilityValidationDb();
  const app = await startApp(fake.db);

  try {
    const visibilityUpdate = await request(app.baseUrl, '/api/docs/api-docs-validation/visibility', {
      method: 'PATCH',
      headers: { authorization: 'Bearer docs-visibility-validation-session' },
      body: JSON.stringify({ docs_visibility: ['public'] }),
    });

    assert.equal(visibilityUpdate.response.status, 400);
    assert.match(visibilityUpdate.body.error, /docs_visibility/i);
    assert.equal(fake.updateAttempts(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('docs visibility validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
