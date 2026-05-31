import assert from 'assert';
import dns from 'dns/promises';
import { resolveCatalogSpecInput } from './catalog-spec-input';
import { fetchSpecFromUrl } from './catalog-spec-url';
import { validateOpenApiSpec } from './versioning';

const originalEnv = {
  nodeEnv: process.env.NODE_ENV,
  specUrlHosts: process.env.GOVHUB_SPEC_URL_HOSTS,
  allowUnlistedSpecUrls: process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS,
  specMaxBytes: process.env.GOVHUB_SPEC_MAX_BYTES,
};
const originalLookup = dns.lookup;
const originalFetch = globalThis.fetch;

function mockPublicSpecHost() {
  (dns as any).lookup = async () => [{ address: '93.184.216.34', family: 4 }];
}

function restoreProcessEnv() {
  if (originalEnv.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnv.nodeEnv;
  if (originalEnv.specUrlHosts === undefined) delete process.env.GOVHUB_SPEC_URL_HOSTS;
  else process.env.GOVHUB_SPEC_URL_HOSTS = originalEnv.specUrlHosts;
  if (originalEnv.allowUnlistedSpecUrls === undefined) delete process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS;
  else process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS = originalEnv.allowUnlistedSpecUrls;
  if (originalEnv.specMaxBytes === undefined) delete process.env.GOVHUB_SPEC_MAX_BYTES;
  else process.env.GOVHUB_SPEC_MAX_BYTES = originalEnv.specMaxBytes;
}

async function runCatalogSpecUrlSecurityTests() {
  process.env.NODE_ENV = 'production';
  process.env.GOVHUB_SPEC_URL_HOSTS = '127.0.0.1';
  delete process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS;

  await assert.rejects(
    () => fetchSpecFromUrl('http://127.0.0.1/openapi.yaml'),
    /Spec URL imports must use https in production/
  );

  process.env.NODE_ENV = 'test';
  process.env.GOVHUB_SPEC_URL_HOSTS = 'spec.example.test';
  process.env.GOVHUB_SPEC_MAX_BYTES = '10';
  mockPublicSpecHost();

  let textWasCalled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('x'.repeat(11)));
      controller.close();
    },
  });
  globalThis.fetch = (async () => ({
    ok: true,
    statusText: 'OK',
    headers: { get: () => null },
    body,
    text: async () => {
      textWasCalled = true;
      return 'x'.repeat(11);
    },
  })) as unknown as typeof fetch;

  await assert.rejects(
    () => fetchSpecFromUrl('http://spec.example.test/openapi.yaml'),
    /Specification content is too large/
  );
  assert.equal(
    textWasCalled,
    false,
    'Spec URL import must enforce byte limits while streaming instead of buffering the full response body.',
  );

  await assert.rejects(
    () => resolveCatalogSpecInput(
      { openapi_spec: 'x'.repeat(11) },
      async () => {
        throw new Error('fetch should not be called for inline specs');
      },
    ),
    /Specification content is too large/,
    'inline OpenAPI specs must honor GOVHUB_SPEC_MAX_BYTES like URL imports do.',
  );

  const externalAuthorityPathSpecs = [
    {
      route: '//attacker.example/collect',
      pattern: /path "\/\/attacker\.example\/collect" must start with a single "\/"/,
    },
    {
      route: '/\\attacker.example/collect',
      pattern: /path "\/\\attacker\.example\/collect" must start with a single "\/"/,
    },
  ];

  for (const { route, pattern } of externalAuthorityPathSpecs) {
    assert.throws(
      () => validateOpenApiSpec(`
openapi: 3.0.0
info:
  title: Redirecting path
  version: 1.0.0
paths:
  ${route}:
    get:
      responses:
        '200':
          description: ok
`),
      pattern,
      'OpenAPI path keys must not be allowed to become external authority URLs in the sandbox console.',
    );
  }

  const externalAuthorityServerSpecs = [
    {
      url: '//attacker.example',
      pattern: /server url "\/\/attacker\.example" must not be protocol-relative/,
    },
    {
      url: '/\\attacker.example',
      pattern: /server url "\/\\attacker\.example" must not contain backslashes/,
    },
  ];

  for (const { url, pattern } of externalAuthorityServerSpecs) {
    assert.throws(
      () => validateOpenApiSpec(`
openapi: 3.0.0
info:
  title: Redirecting server
  version: 1.0.0
servers:
  - url: '${url}'
paths:
  /collect:
    get:
      responses:
        '200':
          description: ok
`),
      pattern,
      'OpenAPI server URLs must not be allowed to become external authority URLs in the sandbox console.',
    );
  }
}

runCatalogSpecUrlSecurityTests()
  .finally(() => {
    restoreProcessEnv();
    (dns as any).lookup = originalLookup;
    globalThis.fetch = originalFetch;
  });
