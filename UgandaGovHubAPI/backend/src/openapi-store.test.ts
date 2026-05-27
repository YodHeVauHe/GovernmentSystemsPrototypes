import assert from 'assert/strict';
import {
  buildOpenApiPath,
  filenameFromOpenApiPath,
  normalizeOpenApiPath,
} from './openapi-store';

assert.equal(buildOpenApiPath('api-nira-01', '1.0.0'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(buildOpenApiPath('api nira 01', 'v2 beta'), '/openapi/api-nira-01-v2-beta.yaml');

assert.equal(normalizeOpenApiPath('/openapi/api-nira-01-1-0-0.yaml'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(normalizeOpenApiPath('api-nira-01-1-0-0.yaml'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(normalizeOpenApiPath('/openapi/../secret.yaml'), null);
assert.equal(normalizeOpenApiPath('/wrong/api.yaml'), null);

assert.equal(filenameFromOpenApiPath('/openapi/api-nira-01-1-0-0.yaml'), 'api-nira-01-1-0-0.yaml');
assert.equal(filenameFromOpenApiPath('/openapi/../secret.yaml'), null);

console.log('openapi store tests passed');
