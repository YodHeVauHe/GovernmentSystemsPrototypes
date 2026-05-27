import assert from 'assert/strict';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { computeVersionStatus, ensureApiVersionSchema, getSpecSha, parseSpecMetadata, slugifyVersion, validateOpenApiSpec } from './versioning';

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

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    openapi_spec_path TEXT,
    openapi_spec_text TEXT
  );
  INSERT INTO apis (id, openapi_spec_path, openapi_spec_text) VALUES ('api-nira-01', '/openapi/nira-identity.yaml', 'openapi: 3.0.0\ninfo:\n  title: NIRA\n  version: 1.0.0\npaths: {}');
`);
ensureApiVersionSchema(db);
const backfilledVersions = db.prepare('SELECT COUNT(*) as count FROM api_versions WHERE api_id = ?').get('api-nira-01') as { count: number };
assert.equal(
  backfilledVersions.count,
  1
);
db.close();

console.log('versioning tests passed');
