import assert from 'assert';
import dns from 'dns/promises';
import { fetchSpecFromUrl } from './catalog-spec-url';

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
}

runCatalogSpecUrlSecurityTests()
  .finally(() => {
    restoreProcessEnv();
    (dns as any).lookup = originalLookup;
    globalThis.fetch = originalFetch;
  });
