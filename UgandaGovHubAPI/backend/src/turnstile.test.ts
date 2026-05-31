import assert from 'node:assert/strict';
import { validateTurnstileToken } from './turnstile';

async function rejectsTokenWithCloudflareErrorCodes() {
  const result = await validateTurnstileToken({
    token: 'token-from-widget',
    action: 'app_load',
    secret: 'production-secret',
    fetchImpl: async () => ({
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-secret'],
      }),
    } as Response),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.message,
      'Human verification failed: invalid-input-secret. Check the Cloudflare Turnstile site key and secret key configuration.'
    );
    assert.deepEqual(result.errors, ['invalid-input-secret']);
  }
}

async function runTests() {
  await rejectsTokenWithCloudflareErrorCodes();
  console.log('turnstile tests passed');
}

runTests().catch(error => {
  console.error(error);
  process.exit(1);
});
