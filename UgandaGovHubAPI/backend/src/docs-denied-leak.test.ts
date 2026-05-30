import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { docsRouter } from './routes/docs';

function createRestrictedDocsDb() {
  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db: Db = {
    async query(sql, params = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql.includes('SELECT id, owning_mda_id, docs_visibility, security_classification FROM apis WHERE id = $1')) {
        assert.deepEqual(params, ['api-restricted']);
        return result([
          {
            id: 'api-restricted',
            owning_mda_id: 'mda-nira',
            docs_visibility: 'restricted',
            security_classification: 'Restricted',
          },
        ]);
      }

      throw new Error(`Unexpected SQL in docs denied leak regression test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(this);
    },
    async close() {},
  };

  return db;
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

async function getJson(baseUrl: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    response,
    body: await response.json(),
  };
}

async function main() {
  const app = await startApp(createRestrictedDocsDb());

  try {
    const detail = await getJson(app.baseUrl, '/api/docs/api-restricted');
    assert.equal(detail.response.status, 401);
    assert.equal(detail.body.code, 'UNAUTHENTICATED');
    assert.equal(Object.prototype.hasOwnProperty.call(detail.body, 'docs_visibility'), false);

    const spec = await getJson(app.baseUrl, '/api/docs/api-restricted/spec');
    assert.equal(spec.response.status, 401);
    assert.equal(spec.body.code, 'UNAUTHENTICATED');
    assert.equal(Object.prototype.hasOwnProperty.call(spec.body, 'docs_visibility'), false);
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('docs denied leak tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
