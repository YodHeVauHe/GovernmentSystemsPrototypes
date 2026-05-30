import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { catalogRouter } from './routes/catalog';

const apiOwner = {
  id: 'usr-catalog-validate-spec-owner',
  full_name: 'Catalog Validate Spec Owner',
  email: 'catalog.validate.spec.owner@example.go.ug',
  password_hash: 'unused',
  account_type: 'mda_api_owner',
  requested_role: 'api_owner',
  requested_mda_id: 'mda-catalog-owner',
  requested_organization: 'Catalog Owner MDA',
  requested_purpose: 'Validate owned API specs',
  status: 'APPROVED',
  role: 'api_owner',
  mda_id: 'mda-catalog-owner',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

function createCatalogValidateSpecValidationDb(): Db {
  return {
    async query(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('FROM sessions s JOIN users u')) {
        return { rows: [apiOwner as any], rowCount: 1 };
      }

      throw new Error(`Unexpected SQL in catalog validate-spec validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
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
  const app = await startApp(createCatalogValidateSpecValidationDb());

  try {
    const validation = await request(app.baseUrl, '/api/catalog/validate-spec', {
      method: 'POST',
      headers: { authorization: 'Bearer catalog-validate-spec-validation-session' },
      body: JSON.stringify({
        specText: { raw: 'openapi: 3.1.0' },
      }),
    });

    assert.equal(validation.response.status, 400);
    assert.equal(validation.body.valid, false);
    assert.match(validation.body.error, /specText/i);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('catalog validate-spec validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
