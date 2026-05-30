import assert from 'assert/strict';
import {
  TURNSTILE_TEST_SITE_KEY,
  isServerVerificationBypassEnabled,
  resolveTurnstileSiteKey,
} from './turnstile-config';

assert.equal(isServerVerificationBypassEnabled('true'), true);
assert.equal(isServerVerificationBypassEnabled(true), true);
assert.equal(isServerVerificationBypassEnabled('false'), false);
assert.equal(isServerVerificationBypassEnabled(undefined), false);

assert.equal(resolveTurnstileSiteKey({ PROD: false }), TURNSTILE_TEST_SITE_KEY);
assert.equal(resolveTurnstileSiteKey({ PROD: true, TURNSTILE_SITE_KEY: 'real-site-key' }), 'real-site-key');
assert.equal(resolveTurnstileSiteKey({ PROD: true, VITE_TURNSTILE_SITE_KEY: 'vite-site-key' }), 'vite-site-key');
assert.throws(
  () => resolveTurnstileSiteKey({ PROD: true }),
  /real TURNSTILE_SITE_KEY is required/,
);
assert.throws(
  () => resolveTurnstileSiteKey({ PROD: true, TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY }),
  /real TURNSTILE_SITE_KEY is required/,
);

console.log('turnstile config tests passed');
