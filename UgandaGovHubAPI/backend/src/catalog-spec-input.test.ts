import assert from 'assert/strict';
import { resolveCatalogSpecInput } from './catalog-spec-input';

async function run() {
  const inline = await resolveCatalogSpecInput({
    openapi_spec: 'openapi: 3.0.0\ninfo:\n  title: Inline\n',
  }, async () => {
    throw new Error('fetcher should not be called for inline specs');
  });
  assert.match(inline, /title: Inline/);

  const fetched = await resolveCatalogSpecInput({
    specUrl: 'https://example.go.ug/openapi.yaml',
  }, async (url: string) => {
    assert.equal(url, 'https://example.go.ug/openapi.yaml');
    return 'openapi: 3.0.0\ninfo:\n  title: Remote\n';
  });
  assert.match(fetched, /title: Remote/);

  await assert.rejects(
    () => resolveCatalogSpecInput({}, async () => ''),
    /openapi_spec or specUrl is required/
  );
}

run().then(() => {
  console.log('catalog spec input tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
