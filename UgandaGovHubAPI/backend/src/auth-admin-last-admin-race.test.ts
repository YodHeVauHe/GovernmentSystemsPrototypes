import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { adminUsersRouter } from './routes/auth';

type UserRow = Record<string, any>;
type Scenario = 'suspend' | 'delete';

function adminUser(overrides: Partial<UserRow>): UserRow {
  return {
    id: 'usr-admin-target',
    full_name: 'Admin Target',
    email: 'admin.target@example.go.ug',
    password_hash: 'hash',
    account_type: 'admin',
    requested_role: 'admin',
    requested_mda_id: 'mda-moict',
    requested_organization: 'Ministry of ICT',
    requested_purpose: 'Administer platform',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-moict',
    reviewed_by: null,
    reviewed_at: '2026-05-30T00:00:00.000Z',
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function createStaleAdminMutationDb(scenario: Scenario) {
  const actor = adminUser({
    id: `usr-admin-actor-${scenario}`,
    full_name: 'Stale Admin Actor',
    email: `admin.actor.${scenario}@example.go.ug`,
  });
  const target = adminUser({
    id: `usr-admin-target-${scenario}`,
    email: `admin.target.${scenario}@example.go.ug`,
  });
  let userTableLocked = false;
  let targetDeleted = false;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  function rowsForUser(id: unknown) {
    if (id === actor.id) return [actor];
    if (id === target.id && !targetDeleted) return [target];
    return [];
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return result([actor]);
      }
      if (normalizedSql === 'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE') {
        userTableLocked = true;
        actor.status = 'SUSPENDED';
        return result([], 0);
      }
      if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
        return result(rowsForUser(params[0]));
      }
      if (normalizedSql.includes("SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED' AND role = 'admin'")) {
        const approvedAdminCount = [actor, target]
          .filter(user => user.status === 'APPROVED' && user.role === 'admin' && (!targetDeleted || user.id !== target.id))
          .length;
        return result([{ count: String(approvedAdminCount) }]);
      }
      if (normalizedSql.includes("UPDATE users SET status = 'SUSPENDED'")) {
        target.status = 'SUSPENDED';
        return result([], 1);
      }
      if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'suspended'")) {
        return result([], 1);
      }
      if (normalizedSql.includes('information_schema.tables')) {
        return result([{ exists: false }]);
      }
      if (normalizedSql.includes('UPDATE sessions SET revoked_at = $1 WHERE user_id = $2')) {
        return result([], 1);
      }
      if (normalizedSql.includes('DELETE FROM verification_documents WHERE user_id = $1')) {
        return result([], 1);
      }
      if (normalizedSql.includes('DELETE FROM user_profiles WHERE user_id = $1')) {
        return result([], 1);
      }
      if (normalizedSql.includes('DELETE FROM sessions WHERE user_id = $1')) {
        return result([], 1);
      }
      if (normalizedSql.includes('DELETE FROM users WHERE id = $1')) {
        targetDeleted = true;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in stale admin mutation regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    actor,
    target,
    wasUserTableLocked: () => userTableLocked,
    wasTargetDeleted: () => targetDeleted,
  };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function withApp<T>(db: Db, callback: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', adminUsersRouter(db));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

async function main() {
  const suspendFixture = createStaleAdminMutationDb('suspend');
  await withApp(suspendFixture.db, async baseUrl => {
    const suspended = await request(baseUrl, `/api/admin/users/${suspendFixture.target.id}/suspend`, {
      method: 'POST',
      headers: { authorization: 'Bearer stale-admin-session' },
    });

    assert.equal(suspended.response.status, 403);
    assert.equal(suspended.body.code, 'FORBIDDEN');
    assert.equal(suspendFixture.wasUserTableLocked(), true);
    assert.equal(suspendFixture.target.status, 'APPROVED');
  });

  const deleteFixture = createStaleAdminMutationDb('delete');
  await withApp(deleteFixture.db, async baseUrl => {
    const deleted = await request(baseUrl, `/api/admin/users/${deleteFixture.target.id}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer stale-admin-session' },
    });

    assert.equal(deleted.response.status, 403);
    assert.equal(deleted.body.code, 'FORBIDDEN');
    assert.equal(deleteFixture.wasUserTableLocked(), true);
    assert.equal(deleteFixture.wasTargetDeleted(), false);
  });
}

main().then(() => {
  console.log('auth admin last-admin race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
