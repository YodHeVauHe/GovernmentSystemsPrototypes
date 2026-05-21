import assert from 'assert/strict';
import { createHash } from 'crypto';
import { computeVersionStatus, getSpecSha, parseSpecMetadata, slugifyVersion } from './versioning';

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

assert.equal(computeVersionStatus({ currentSha: 'abc', versionSha: 'abc' }), 'current');
assert.equal(computeVersionStatus({ currentSha: 'abc', versionSha: 'def' }), 'available');
assert.equal(computeVersionStatus({ currentSha: '', versionSha: 'def' }), 'available');

console.log('versioning tests passed');
