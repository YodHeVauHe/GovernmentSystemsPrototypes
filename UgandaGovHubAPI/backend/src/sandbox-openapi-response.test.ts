import assert from 'assert/strict';
import { productionDemoApis } from './seed-production-demo-catalog';
import { findSandboxOpenApiResponseExample } from './sandbox-openapi-response';

const uraSpec = productionDemoApis.find(api => api.id === 'api-ura-13897843-012d-4951-8b06-374fff183c3e')?.spec as any;
assert.ok(uraSpec, 'URA demo spec should be available');

const tinStatusExample = uraSpec.paths['/tin-status/{tin}'].get.responses['200'].content['application/json'].example;
assert.deepEqual(
  findSandboxOpenApiResponseExample(uraSpec, '/api/v1/tax/tin-status/1000123456', 'GET'),
  tinStatusExample
);

const clearanceExample = uraSpec.paths['/clearance/{tin}'].get.responses['200'].content['application/json'].example;
assert.deepEqual(
  findSandboxOpenApiResponseExample(uraSpec, '/api/v1/tax/clearance/1000123456', 'GET'),
  clearanceExample
);

const filingObligationsExample = uraSpec.paths['/filing-obligations/{tin}'].get.responses['200'].content['application/json'].example;
assert.deepEqual(
  findSandboxOpenApiResponseExample(uraSpec, '/api/v1/tax/filing-obligations/1000123456?demo=true', 'GET'),
  filingObligationsExample
);

assert.equal(
  findSandboxOpenApiResponseExample(uraSpec, '/api/v1/tax/tin-status/1000123456', 'POST'),
  null
);

console.log('sandbox openapi response tests passed');
