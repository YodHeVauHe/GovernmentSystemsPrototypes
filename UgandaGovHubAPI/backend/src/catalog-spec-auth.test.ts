import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { catalogRouter } from './routes/catalog';

function createCatalogSpecAuthDb(): Db {
  return {
    async query(sql, params = []) {
      if (/FROM apis\s+WHERE id = \$1\s+AND openapi_spec_path IS NOT NULL/i.test(sql)) {
        assert.equal(params[0], 'api-restricted');
        return {
          rows: [{
            api_id: 'api-restricted',
            openapi_spec_path: '/openapi/public.yaml',
            openapi_spec_text: 'openapi: 3.0.0\ninfo:\n  title: Restricted Spec\n  version: "1.0.0"\npaths: {}\n',
          } as any],
          rowCount: 1,
        };
      }

      if (/SELECT id FROM apis WHERE openapi_spec_path = \$1/i.test(sql)) {
        assert.equal(params[0], '/openapi/public.yaml');
        return { rows: [{ id: 'api-public' } as any], rowCount: 1 };
      }

      if (/SELECT id, owning_mda_id, docs_visibility, security_classification\s+FROM apis\s+WHERE id = \$1/i.test(sql)) {
        if (params[0] === 'api-public') {
          return {
            rows: [{
              id: 'api-public',
              owning_mda_id: 'mda-public',
              docs_visibility: 'public',
              security_classification: 'Public',
            } as any],
            rowCount: 1,
          };
        }
        if (params[0] === 'api-restricted') {
          return {
            rows: [{
              id: 'api-restricted',
              owning_mda_id: 'mda-secret',
              docs_visibility: 'restricted',
              security_classification: 'Restricted',
            } as any],
            rowCount: 1,
          };
        }
      }

      throw new Error(`Unexpected query in catalog spec auth regression test: ${sql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };
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
  const { server, baseUrl } = await startApp(createCatalogSpecAuthDb());

  try {
    const response = await fetch(`${baseUrl}/api/catalog/api-restricted/spec`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.code, 'UNAUTHENTICATED');
    assert.equal(body.info, undefined);
  } finally {
    await close(server);
  }
}

main().then(() => {
  console.log('catalog spec auth tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
