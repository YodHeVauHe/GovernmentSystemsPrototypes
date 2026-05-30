import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { SESSION_COOKIE_NAME } from './auth';
import type { Db } from './db';
import { catalogVersionsRouter } from './routes/catalog-versions';

const adminUser = {
  id: 'usr-version-admin',
  full_name: 'Version Admin',
  email: 'version.admin@example.go.ug',
  password_hash: 'unused',
  account_type: 'government_employee',
  requested_role: 'admin',
  requested_mda_id: 'mda-moict',
  requested_organization: 'MoICT',
  requested_purpose: 'Regression test',
  status: 'APPROVED',
  role: 'admin',
  mda_id: 'mda-moict',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-22T10:00:00.000Z',
  updated_at: '2026-05-22T10:00:00.000Z',
};

function createStaleVersionPromotionDb() {
  let apiUpdates = 0;
  let auditWrites = 0;
  let stalePromoteAttempts = 0;

  const db: Db = {
    async query(sql, params = []) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [adminUser as any], rowCount: 1 };
      }

      if (/SELECT \* FROM api_versions WHERE api_id = \$1 AND version = \$2/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01', '2.0.0']);
        return {
          rows: [{
            id: 'api-nira-01-2-0-0',
            api_id: 'api-nira-01',
            version: '2.0.0',
            openapi_spec_path: '/openapi/api-nira-01-2-0-0.yaml',
            openapi_spec_text: 'openapi: 3.0.0\ninfo:\n  title: NIRA\n  version: "2.0.0"\npaths: {}\n',
            is_current: false,
          } as any],
          rowCount: 1,
        };
      }

      if (/UPDATE api_versions SET is_current = FALSE WHERE api_id = \$1/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01']);
        return { rows: [], rowCount: 1 };
      }

      if (/UPDATE\s+api_versions\s+SET\s+is_current\s*=\s*TRUE[\s\S]*WHERE\s+id\s*=\s*\$1[\s\S]*api_id\s*=\s*\$2/i.test(sql)) {
        stalePromoteAttempts += 1;
        assert.deepEqual(params, ['api-nira-01-2-0-0', 'api-nira-01']);
        return { rows: [], rowCount: 0 };
      }

      if (/UPDATE apis SET openapi_spec_path = \$1, openapi_spec_text = \$2 WHERE id = \$3/i.test(sql)) {
        apiUpdates += 1;
        return { rows: [], rowCount: 1 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in catalog version race regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    apiUpdates: () => apiUpdates,
    auditWrites: () => auditWrites,
    stalePromoteAttempts: () => stalePromoteAttempts,
  };
}

function createStaleVersionDeleteDb() {
  let deleteAttempts = 0;
  let auditWrites = 0;

  const db: Db = {
    async query(sql, params = []) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [adminUser as any], rowCount: 1 };
      }

      if (/SELECT \* FROM api_versions WHERE api_id = \$1 AND version = \$2/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01', '2.0.0']);
        return {
          rows: [{
            id: 'api-nira-01-2-0-0',
            api_id: 'api-nira-01',
            version: '2.0.0',
            is_current: false,
          } as any],
          rowCount: 1,
        };
      }

      if (/DELETE\s+FROM\s+api_versions[\s\S]*WHERE\s+id\s*=\s*\$1[\s\S]*api_id\s*=\s*\$2[\s\S]*COALESCE\(is_current,\s*FALSE\)\s*=\s*FALSE/i.test(sql)) {
        deleteAttempts += 1;
        assert.deepEqual(params, ['api-nira-01-2-0-0', 'api-nira-01']);
        return { rows: [], rowCount: 0 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in catalog version delete race regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    deleteAttempts: () => deleteAttempts,
    auditWrites: () => auditWrites,
  };
}

function createStaleVersionPublishApiDb() {
  let versionCurrentClears = 0;
  let apiSpecUpdates = 0;
  let apiVersionInserts = 0;
  let auditWrites = 0;

  const db: Db = {
    async query(sql, params = []) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [adminUser as any], rowCount: 1 };
      }

      if (/SELECT id FROM apis WHERE id = \$1/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01']);
        return { rows: [{ id: 'api-nira-01' }], rowCount: 1 };
      }

      if (/SELECT id FROM api_versions WHERE api_id = \$1 AND \(version = \$2 OR id = \$3\)/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01', '3.0.0', 'api-nira-01-3-0-0']);
        return { rows: [], rowCount: 0 };
      }

      if (/UPDATE api_versions SET is_current = FALSE WHERE api_id = \$1/i.test(sql)) {
        versionCurrentClears += 1;
        assert.deepEqual(params, ['api-nira-01']);
        return { rows: [], rowCount: 1 };
      }

      if (/UPDATE apis SET openapi_spec_path = \$1, openapi_spec_text = \$2 WHERE id = \$3/i.test(sql)) {
        apiSpecUpdates += 1;
        assert.equal(params[2], 'api-nira-01');
        return { rows: [], rowCount: 0 };
      }

      if (/INSERT INTO api_versions/i.test(sql)) {
        apiVersionInserts += 1;
        return { rows: [], rowCount: 1 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in catalog version publish API race regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    versionCurrentClears: () => versionCurrentClears,
    apiSpecUpdates: () => apiSpecUpdates,
    apiVersionInserts: () => apiVersionInserts,
    auditWrites: () => auditWrites,
  };
}

function createDuplicateVersionPublishDb() {
  let apiVersionInserts = 0;
  let auditWrites = 0;

  const db: Db = {
    async query(sql, params = []) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [adminUser as any], rowCount: 1 };
      }

      if (/SELECT id FROM apis WHERE id = \$1/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01']);
        return { rows: [{ id: 'api-nira-01' }], rowCount: 1 };
      }

      if (/SELECT id FROM api_versions WHERE api_id = \$1 AND \(version = \$2 OR id = \$3\)/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01', '3.0.0', 'api-nira-01-3-0-0']);
        return { rows: [], rowCount: 0 };
      }

      if (/INSERT INTO api_versions/i.test(sql)) {
        apiVersionInserts += 1;
        return { rows: [], rowCount: 0 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in duplicate catalog version publish regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    apiVersionInserts: () => apiVersionInserts,
    auditWrites: () => auditWrites,
  };
}

function createDeletedApiVersionPublishDb() {
  let apiVersionInserts = 0;
  let auditWrites = 0;

  const db: Db = {
    async query(sql, params = []) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [adminUser as any], rowCount: 1 };
      }

      if (/SELECT id FROM apis WHERE id = \$1/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01']);
        return { rows: [{ id: 'api-nira-01' }], rowCount: 1 };
      }

      if (/SELECT id FROM api_versions WHERE api_id = \$1 AND \(version = \$2 OR id = \$3\)/i.test(sql)) {
        assert.deepEqual(params, ['api-nira-01', '3.0.0', 'api-nira-01-3-0-0']);
        return { rows: [], rowCount: 0 };
      }

      if (/INSERT INTO api_versions/i.test(sql)) {
        apiVersionInserts += 1;
        throw Object.assign(new Error('insert or update on table "api_versions" violates foreign key constraint'), {
          code: '23503',
        });
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in deleted API version publish regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return {
    db,
    apiVersionInserts: () => apiVersionInserts,
    auditWrites: () => auditWrites,
  };
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
  const promotionFake = createStaleVersionPromotionDb();
  const promotionApp = await startApp(promotionFake.db);

  try {
    const response = await fetch(`${promotionApp.baseUrl}/api/catalog/api-nira-01/versions/2.0.0/current`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'VERSION_PROMOTION_STALE');
    assert.equal(promotionFake.stalePromoteAttempts(), 1);
    assert.equal(promotionFake.apiUpdates(), 0);
    assert.equal(promotionFake.auditWrites(), 0);
  } finally {
    await close(promotionApp.server);
  }

  const deleteFake = createStaleVersionDeleteDb();
  const deleteApp = await startApp(deleteFake.db);

  try {
    const response = await fetch(`${deleteApp.baseUrl}/api/catalog/api-nira-01/versions/2.0.0`, {
      method: 'DELETE',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'VERSION_DELETE_STALE');
    assert.equal(deleteFake.deleteAttempts(), 1);
    assert.equal(deleteFake.auditWrites(), 0);
  } finally {
    await close(deleteApp.server);
  }

  const stalePublishApiFake = createStaleVersionPublishApiDb();
  const stalePublishApiApp = await startApp(stalePublishApiFake.db);

  try {
    const response = await fetch(`${stalePublishApiApp.baseUrl}/api/catalog/api-nira-01/versions`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        make_current: true,
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: NIRA\n  version: "3.0.0"\npaths: {}\n',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'VERSION_PUBLISH_STALE');
    assert.equal(stalePublishApiFake.versionCurrentClears(), 1);
    assert.equal(stalePublishApiFake.apiSpecUpdates(), 1);
    assert.equal(stalePublishApiFake.apiVersionInserts(), 0);
    assert.equal(stalePublishApiFake.auditWrites(), 0);
  } finally {
    await close(stalePublishApiApp.server);
  }

  const duplicatePublishFake = createDuplicateVersionPublishDb();
  const duplicatePublishApp = await startApp(duplicatePublishFake.db);

  try {
    const response = await fetch(`${duplicatePublishApp.baseUrl}/api/catalog/api-nira-01/versions`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: NIRA\n  version: "3.0.0"\npaths: {}\n',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'VERSION_PUBLISH_STALE');
    assert.equal(duplicatePublishFake.apiVersionInserts(), 1);
    assert.equal(duplicatePublishFake.auditWrites(), 0);
  } finally {
    await close(duplicatePublishApp.server);
  }

  const deletedApiPublishFake = createDeletedApiVersionPublishDb();
  const deletedApiPublishApp = await startApp(deletedApiPublishFake.db);

  try {
    const response = await fetch(`${deletedApiPublishApp.baseUrl}/api/catalog/api-nira-01/versions`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=admin-session-token`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        openapi_spec: 'openapi: 3.1.0\ninfo:\n  title: NIRA\n  version: "3.0.0"\npaths: {}\n',
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.code, 'VERSION_PUBLISH_STALE');
    assert.equal(deletedApiPublishFake.apiVersionInserts(), 1);
    assert.equal(deletedApiPublishFake.auditWrites(), 0);
  } finally {
    await close(deletedApiPublishApp.server);
  }
}

main().then(() => {
  console.log('catalog version race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
