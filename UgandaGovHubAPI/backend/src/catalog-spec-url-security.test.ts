import assert from 'assert';
import dns from 'dns/promises';
import http from 'http';
import { Readable } from 'stream';
import { resolveCatalogSpecInput } from './catalog-spec-input';
import { fetchSpecFromUrl } from './catalog-spec-url';
import { parseStoredOpenApiSpec } from './openapi-store';
import { validateOpenApiSpec } from './versioning';

const originalEnv = {
  nodeEnv: process.env.NODE_ENV,
  specUrlHosts: process.env.GOVHUB_SPEC_URL_HOSTS,
  allowUnlistedSpecUrls: process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS,
  specMaxBytes: process.env.GOVHUB_SPEC_MAX_BYTES,
};
const originalLookup = dns.lookup;
const originalFetch = globalThis.fetch;
const originalHttpRequest = http.request;

function mockPublicSpecHost() {
  (dns as any).lookup = async () => [{ address: '93.184.216.34', family: 4 }];
}

function readableResponse(chunks: string[], statusCode = 200, headers: Record<string, string> = {}) {
  const response = Readable.from(chunks) as any;
  response.statusCode = statusCode;
  response.statusMessage = 'OK';
  response.headers = headers;
  return response;
}

function mockHttpResponse({
  chunks,
  headers = {},
  onRequest,
  statusCode = 200,
}: {
  chunks: string[];
  headers?: Record<string, string>;
  onRequest?: (url: URL, options: any) => void;
  statusCode?: number;
}) {
  let destroyWasCalled = false;
  (http as any).request = (urlOrOptions: URL | any, optionsOrCallback: any, maybeCallback?: any) => {
    const url = urlOrOptions instanceof URL
      ? urlOrOptions
      : new URL(`${urlOrOptions.protocol}//${urlOrOptions.hostname}${urlOrOptions.path}`);
    const options = urlOrOptions instanceof URL ? optionsOrCallback : urlOrOptions;
    const callback = urlOrOptions instanceof URL ? maybeCallback : optionsOrCallback;

    onRequest?.(url, options);
    queueMicrotask(() => callback(readableResponse(chunks, statusCode, headers)));
    return {
      on: () => undefined,
      setTimeout: () => undefined,
      destroy: () => {
        destroyWasCalled = true;
      },
      end: () => undefined,
    };
  };
  return {
    wasDestroyed: () => destroyWasCalled,
  };
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
  process.env.GOVHUB_SPEC_MAX_BYTES = '1024';
  mockPublicSpecHost();

  let requestCalled = false;
  let fetchWasCalled = false;
  let pinnedLookupAddress: string | undefined;
  let pinnedLookupFamily: number | undefined;
  const validOpenApiSpec = `
openapi: 3.0.0
info:
  title: Remote spec
  version: 1.0.0
paths:
  /status:
    get:
      responses:
        '200':
          description: ok
`;
  mockHttpResponse({
    chunks: [validOpenApiSpec],
    onRequest: (url, options) => {
      requestCalled = true;
      assert.equal(url.hostname, 'spec.example.test');
      assert.equal(typeof options.lookup, 'function', 'spec URL imports must pin the vetted DNS address for the HTTP request');
      options.lookup('spec.example.test', {}, (error: Error | null, address: string, family: number) => {
        assert.ifError(error);
        pinnedLookupAddress = address;
        pinnedLookupFamily = family;
      });
    },
  });
  globalThis.fetch = (async () => {
    fetchWasCalled = true;
    throw new Error('fetch should not be used for spec URL imports after DNS preflight');
  }) as unknown as typeof fetch;

  const fetchedSpec = await fetchSpecFromUrl('http://spec.example.test/openapi.yaml');
  assert.equal(fetchedSpec, validOpenApiSpec);
  assert.equal(requestCalled, true, 'Spec URL imports must use the HTTP client configured with pinned DNS lookup.');
  assert.equal(fetchWasCalled, false, 'Spec URL imports must not resolve the host a second time through fetch.');
  assert.equal(pinnedLookupAddress, '93.184.216.34');
  assert.equal(pinnedLookupFamily, 4);

  process.env.GOVHUB_SPEC_MAX_BYTES = '10';

  let oversizedFetchWasCalled = false;
  const oversizedRequest = mockHttpResponse({ chunks: ['x'.repeat(11)] });
  globalThis.fetch = (async () => {
    oversizedFetchWasCalled = true;
    throw new Error('fetch should not be called for spec URL imports');
  }) as unknown as typeof fetch;

  await assert.rejects(
    () => fetchSpecFromUrl('http://spec.example.test/openapi.yaml'),
    /Specification content is too large/
  );
  assert.equal(
    oversizedFetchWasCalled,
    false,
    'Spec URL import must enforce byte limits on the pinned HTTP request instead of falling back to fetch.',
  );
  assert.equal(oversizedRequest.wasDestroyed(), true, 'oversized spec URL responses must be aborted while streaming.');

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

  assert.throws(
    () => parseStoredOpenApiSpec(`
openapi: 3.0.0
info:
  title: Circular spec
  version: 1.0.0
paths:
  /status: &statusPath
    get:
      responses:
        '200':
          description: ok
      x-cycle: *statusPath
`),
    /circular YAML aliases are not allowed/,
    'stored OpenAPI specs with cyclic YAML aliases must be rejected before they can break JSON spec responses.',
  );
}

runCatalogSpecUrlSecurityTests()
  .finally(() => {
    restoreProcessEnv();
    (dns as any).lookup = originalLookup;
    globalThis.fetch = originalFetch;
    (http as any).request = originalHttpRequest;
  });
