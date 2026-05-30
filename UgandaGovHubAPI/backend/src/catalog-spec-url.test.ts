import assert from 'assert/strict';
import dns from 'dns/promises';
import { fetchSpecFromUrl } from './catalog-spec-url';

const originalLookup = dns.lookup;
const originalFetch = globalThis.fetch;
const originalAllowUnlisted = process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS;
const originalAllowedHosts = process.env.GOVHUB_SPEC_URL_HOSTS;
const originalMaxBytes = process.env.GOVHUB_SPEC_MAX_BYTES;
const originalTimeoutMs = process.env.GOVHUB_SPEC_FETCH_TIMEOUT_MS;

async function withMockedFetchEnvironment(
  address: string,
  test: () => Promise<void>,
  response: { content?: string; contentLength?: string | null } = {},
) {
  process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS = 'true';
  delete process.env.GOVHUB_SPEC_URL_HOSTS;
  (dns as any).lookup = async () => [{ address, family: address.includes(':') ? 6 : 4 }];
  (globalThis as any).fetch = async () => ({
    ok: true,
    headers: { get: () => response.contentLength ?? null },
    text: async () => response.content ?? 'openapi: 3.0.0\ninfo:\n  title: Remote\n  version: 1.0.0\npaths: {}\n',
  });

  try {
    await test();
  } finally {
    (dns as any).lookup = originalLookup;
    (globalThis as any).fetch = originalFetch;
    if (originalAllowUnlisted === undefined) {
      delete process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS;
    } else {
      process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS = originalAllowUnlisted;
    }
    if (originalAllowedHosts === undefined) {
      delete process.env.GOVHUB_SPEC_URL_HOSTS;
    } else {
      process.env.GOVHUB_SPEC_URL_HOSTS = originalAllowedHosts;
    }
    if (originalMaxBytes === undefined) {
      delete process.env.GOVHUB_SPEC_MAX_BYTES;
    } else {
      process.env.GOVHUB_SPEC_MAX_BYTES = originalMaxBytes;
    }
    if (originalTimeoutMs === undefined) {
      delete process.env.GOVHUB_SPEC_FETCH_TIMEOUT_MS;
    } else {
      process.env.GOVHUB_SPEC_FETCH_TIMEOUT_MS = originalTimeoutMs;
    }
  }
}

async function run() {
  await withMockedFetchEnvironment('fe81::1', async () => {
    await assert.rejects(
      () => fetchSpecFromUrl('https://example.go.ug/openapi.yaml'),
      /blocked private or local address/
    );
  });

  await withMockedFetchEnvironment('::ffff:7f00:1', async () => {
    await assert.rejects(
      () => fetchSpecFromUrl('https://example.go.ug/openapi.yaml'),
      /blocked private or local address/
    );
  });

  await withMockedFetchEnvironment('0:0:0:0:0:ffff:127.0.0.1', async () => {
    await assert.rejects(
      () => fetchSpecFromUrl('https://example.go.ug/openapi.yaml'),
      /blocked private or local address/
    );
  });

  await withMockedFetchEnvironment('64:ff9b::127.0.0.1', async () => {
    await assert.rejects(
      () => fetchSpecFromUrl('https://example.go.ug/openapi.yaml'),
      /blocked private or local address/
    );
  });

  await withMockedFetchEnvironment('93.184.216.34', async () => {
    const spec = await fetchSpecFromUrl('https://example.go.ug/openapi.yaml');
    assert.match(spec, /title: Remote/);
  });

  await withMockedFetchEnvironment('93.184.216.34', async () => {
    process.env.GOVHUB_SPEC_MAX_BYTES = 'not-a-number';
    await assert.rejects(
      () => fetchSpecFromUrl('https://example.go.ug/openapi.yaml'),
      /Specification content is too large/
    );
  }, { content: 'x'.repeat(1024 * 1024 + 1), contentLength: null });
}

run().then(() => {
  console.log('catalog spec URL tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
