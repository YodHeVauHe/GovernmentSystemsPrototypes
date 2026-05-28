import assert from 'assert/strict';
import { productionDemoApis } from './seed-production-demo-catalog';

const allowedMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

for (const api of productionDemoApis) {
  const spec = api.spec as any;
  assert.equal(spec.openapi, '3.0.3', `${api.id} should seed an OpenAPI 3.0.3 spec`);
  assert.ok(spec.info?.contact?.email, `${api.id} should include contact metadata`);
  assert.ok(spec.servers?.[0]?.url?.includes('/api/v1/'), `${api.id} should put the API base path in servers`);
  assert.ok(spec.components?.schemas?.SandboxError, `${api.id} should include reusable error schema`);
  assert.ok(Object.keys(spec.paths).length >= 6, `${api.id} should preserve the expanded production endpoint set`);

  for (const [route, pathItem] of Object.entries(spec.paths) as Array<[string, Record<string, any>]>) {
    assert.ok(!route.startsWith('/v1/'), `${api.id} ${route} should not repeat the server base path`);

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!allowedMethods.has(method)) continue;

      assert.ok(operation.operationId, `${api.id} ${method.toUpperCase()} ${route} should include an operationId`);
      assert.ok(operation.description.length > 160, `${api.id} ${route} should include production-grade operation notes`);
      assert.ok(operation.responses?.['200']?.content?.['application/json']?.example, `${api.id} ${route} should include a 200 response example`);
      assert.notEqual(operation.responses?.['200']?.content?.['application/json']?.schema?.$ref, '#/components/schemas/SandboxResponse');
      assert.equal(operation.responses?.['400']?.content?.['application/json']?.schema?.$ref, '#/components/schemas/SandboxError');
      assert.equal(operation.responses?.['401']?.content?.['application/json']?.schema?.$ref, '#/components/schemas/SandboxError');
      assert.equal(operation.responses?.['403']?.content?.['application/json']?.schema?.$ref, '#/components/schemas/SandboxError');

      const pathParams = [...route.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
      for (const paramName of pathParams) {
        assert.ok(
          operation.parameters?.some((parameter: any) => parameter.in === 'path' && parameter.name === paramName && parameter.required),
          `${api.id} ${route} should document path parameter ${paramName}`
        );
      }

      if (['post', 'put', 'patch'].includes(method)) {
        assert.ok(operation.requestBody?.content?.['application/json']?.example, `${api.id} ${method.toUpperCase()} ${route} should include a request example`);
        assert.notEqual(operation.requestBody?.content?.['application/json']?.schema?.$ref, '#/components/schemas/SandboxRequest');
      }
    }
  }
}

console.log('production demo catalog seed docs tests passed');
