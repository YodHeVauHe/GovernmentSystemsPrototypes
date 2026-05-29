import assert from 'assert/strict';
import { productionDemoApis } from './production-demo-catalog-data';
import { syncProductionDemoCatalog } from './seed-production-demo-catalog';

const allowedMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head']);

type PreparedCall = {
  method: 'query';
  sql: string;
  params: readonly unknown[];
};

function createRecordingDb() {
  const calls: PreparedCall[] = [];

  return {
    calls,
    db: {
      async query(sql: string, params: readonly unknown[] = []) {
        calls.push({ method: 'query', sql, params });
        return { rows: [], rowCount: 0 };
      },
    } as any,
  };
}

function assertProductionDemoSpecs() {
  assert.equal(typeof syncProductionDemoCatalog, 'function', 'production app startup should be able to sync the rich demo catalog');
  assert.equal(new Set(productionDemoApis.map(api => api.id)).size, productionDemoApis.length, 'production demo API IDs should be unique');
  assert.equal(new Set(productionDemoApis.map(api => api.name)).size, productionDemoApis.length, 'production demo API names should be unique');

  for (const api of productionDemoApis) {
    assert.ok(!/^api-[a-z]+-01$/.test(api.id), `${api.name} should not use a sequential legacy API id`);

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
}

async function assertLegacyDemoRowsAreCleanedUp() {
  const { db, calls } = createRecordingDb();

  await syncProductionDemoCatalog(db);

  assert.ok(
    calls.some(call => /UPDATE\s+access_requests/i.test(call.sql) && call.params.includes('api-mowt-01')),
    'production sync should migrate access requests from legacy demo API ids before deleting duplicates'
  );
  assert.ok(
    calls.some(call => /DELETE\s+FROM\s+api_versions/i.test(call.sql) && call.params.includes('api-mowt-01')),
    'production sync should delete legacy demo API versions'
  );
  assert.ok(
    calls.some(call => /DELETE\s+FROM\s+apis/i.test(call.sql) && call.params.includes('api-mowt-01')),
    'production sync should delete legacy demo API rows'
  );
}

async function main() {
  assertProductionDemoSpecs();
  await assertLegacyDemoRowsAreCleanedUp();
  console.log('production demo catalog seed docs tests passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
