import assert from 'assert/strict';
import { createHash } from 'crypto';
import { computeVersionStatus, ensureApiVersionSchema, getSpecSha, parseSpecMetadata, slugifyVersion, validateOpenApiSpec } from './versioning';
import { withPostgresTestDb } from './postgres-test-db';

const spec = `
openapi: 3.0.3
info:
  title: Example API
  version: 2.1.0
paths:
  /status:
    get:
      responses:
        "200":
          description: OK
`;

async function main() {
  assert.equal(slugifyVersion(' v2.1.0 '), 'v2-1-0');
  assert.equal(getSpecSha(spec), createHash('sha256').update(spec).digest('hex'));

  const metadata = parseSpecMetadata(spec);
  assert.deepEqual(metadata, {
    version: '2.1.0',
    openapiVersion: '3.0.3',
    endpointsCount: 1,
  });
  assert.equal(validateOpenApiSpec(spec).metadata.version, '2.1.0');
  assert.throws(
    () => validateOpenApiSpec('info:\n  version: 1.0.0\npaths: {}'),
    /missing "openapi" or "swagger"/
  );
  assert.throws(
    () => validateOpenApiSpec('openapi: 3.0.3\ninfo:\n  version: 1.0.0\npaths: {}'),
    /missing "info.title"/
  );

  assert.equal(computeVersionStatus({ currentSha: 'abc', versionSha: 'abc' }), 'current');
  assert.equal(computeVersionStatus({ currentSha: 'abc', versionSha: 'def' }), 'available');
  assert.equal(computeVersionStatus({ currentSha: '', versionSha: 'def' }), 'available');

  await withPostgresTestDb(async db => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mdas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS apis (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owning_mda_id TEXT NOT NULL,
        openapi_spec_path TEXT,
        openapi_spec_text TEXT
      );
    `);
    await db.prepare('INSERT INTO mdas (id, name, short_name) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING')
      .run('mda-test-versioning', 'Versioning Test MDA', 'VT');
    await db.prepare(`
      INSERT INTO apis (id, name, owning_mda_id, openapi_spec_path, openapi_spec_text)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'api-test-versioning',
      'Versioning Test API',
      'mda-test-versioning',
      '/openapi/nira-identity.yaml',
      'openapi: 3.0.0\ninfo:\n  title: NIRA\n  version: 1.0.0\npaths: {}'
    );

    await ensureApiVersionSchema(db);
    const backfilledVersions = await db.prepare('SELECT COUNT(*) as count FROM api_versions WHERE api_id = ?').get<{ count: string }>('api-test-versioning');
    assert.equal(Number(backfilledVersions?.count || 0), 1);
  });
}

main().then(() => {
  console.log('versioning tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
