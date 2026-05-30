import assert from 'assert/strict';
import { isServerVerificationBypassEnabled } from './turnstile-config';

assert.equal(isServerVerificationBypassEnabled('true'), true);
assert.equal(isServerVerificationBypassEnabled(true), true);
assert.equal(isServerVerificationBypassEnabled('false'), false);
assert.equal(isServerVerificationBypassEnabled(undefined), false);

console.log('turnstile config tests passed');
