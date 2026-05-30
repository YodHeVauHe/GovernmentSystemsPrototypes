import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { docsRouter } from './routes/docs';

const apiOwner = {
  id: 'usr-docs-owner',
  full_name: 'Docs Owner',
  email: 'docs.owner@example.go.ug',
  password_hash: 'unused',
  account_type: 'mda_api_owner',
  requested_role: 'api_owner',
  requested_mda_id: 'mda-old-owner',
  requested_organization: 'Old Owner MDA',
  requested_purpose: 'Manage owned API docs',
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

function createStaleDocsVisibilityDb() {
  const api = {
    id: 'api-docs-stale',
    owning_mda_id: 'mda-old-owner',
    docs_visibility: 'restricted',
  };
  let updateAttempts = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([apiOwner as any]);
      }
      if (normalizedSql.includes('SELECT id FROM apis WHERE id = $1 AND owning_mda_id = $2')) {
        assert.deepEqual(params, ['api-docs-stale', 'mda-old-owner']);
        api.owning_mda_id = 'mda-new-owner';
        return result([{ id: api.id }]);
      }
      if (normalizedSql.startsWith('UPDATE apis SET docs_visibility = $1 WHERE id = $2')) {
        updateAttempts += 1;
        const hasOwnerGuard = normalizedSql.includes('AND ($3 = TRUE OR owning_mda_id = $4)');
        if (hasOwnerGuard && params[2] !== true && api.owning_mda_id !== params[3]) {
          return result([], 0);
        }
        api.docs_visibility = String(params[0]);
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in docs visibility race test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    api,
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
  const fake = createStaleDocsVisibilityDb();
  const app = await startApp(fake.db);

  try {
    const staleVisibilityUpdate = await request(app.baseUrl, '/api/docs/api-docs-stale/visibility', {
      method: 'PATCH',
      headers: { authorization: 'Bearer stale-docs-owner-session' },
      body: JSON.stringify({ docs_visibility: 'public' }),
    });

    assert.equal(staleVisibilityUpdate.response.status, 409);
    assert.equal(staleVisibilityUpdate.body.code, 'DOCS_VISIBILITY_UPDATE_STALE');
    assert.equal(fake.api.docs_visibility, 'restricted');
    assert.equal(fake.api.owning_mda_id, 'mda-new-owner');
    assert.equal(fake.updateAttempts(), 1);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('docs visibility race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
