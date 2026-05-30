import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { catalogRouter } from './routes/catalog';

const apiOwner = {
  id: 'usr-catalog-owner',
  full_name: 'Catalog Owner',
  email: 'catalog.owner@example.go.ug',
  password_hash: 'unused',
  account_type: 'mda_api_owner',
  requested_role: 'api_owner',
  requested_mda_id: 'mda-old-owner',
  requested_organization: 'Old Owner MDA',
  requested_purpose: 'Manage owned APIs',
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

function createStaleCatalogUpdateDb() {
  const api = {
    id: 'api-stale-update',
    name: 'Original API Name',
    owning_mda_id: 'mda-old-owner',
    sector: 'Identity',
    description: 'Original description',
    lifecycle_status: 'Production',
    sensitivity_level: 'High',
    sandbox_available: true,
    openapi_spec_path: '/openapi/api-stale-update.yaml',
    openapi_spec_text: 'openapi: 3.1.0\ninfo:\n  title: Original\n  version: 1.0.0\npaths: {}\n',
    required_approval_level: 'MDA Approval',
    contact_office: 'owner@example.go.ug',
    technical_owner: 'Owner team',
    personal_data_categories: '',
    purpose_limitation: '',
    data_minimization_note: '',
    retention_class: 'Default',
    statutory_basis: 'None',
    security_classification: 'Restricted',
    sla_target: '99.5%',
    compliance_status: 'Approved',
    docs_visibility: 'restricted',
  };
  let auditWrites = 0;
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
        api.owning_mda_id = 'mda-new-owner';
        return result([{ id: api.id }]);
      }
      if (normalizedSql.includes('SELECT * FROM apis WHERE id = $1')) {
        return result(params[0] === api.id ? [api] : []);
      }
      if (normalizedSql.startsWith('UPDATE apis SET')) {
        updateAttempts += 1;
        const hasOwnershipGuard = normalizedSql.includes('AND ($23 = TRUE OR owning_mda_id = $24)');
        if (hasOwnershipGuard && params[22] !== true && api.owning_mda_id !== params[23]) {
          return result([], 0);
        }
        api.name = String(params[0]);
        api.owning_mda_id = String(params[1]);
        return result([], 1);
      }
      if (normalizedSql.includes('INSERT INTO audit_logs')) {
        auditWrites += 1;
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in stale catalog update regression test: ${normalizedSql}`);
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
    auditWrites: () => auditWrites,
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
  const fake = createStaleCatalogUpdateDb();
  const app = await startApp(fake.db);

  try {
    const staleUpdate = await request(app.baseUrl, '/api/catalog/api-stale-update', {
      method: 'PATCH',
      headers: { authorization: 'Bearer stale-catalog-owner-session' },
      body: JSON.stringify({ name: 'Stale owner rename' }),
    });

    assert.equal(staleUpdate.response.status, 409);
    assert.equal(staleUpdate.body.code, 'API_UPDATE_STALE');
    assert.equal(fake.api.name, 'Original API Name');
    assert.equal(fake.api.owning_mda_id, 'mda-new-owner');
    assert.equal(fake.updateAttempts(), 1);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('catalog update race tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
