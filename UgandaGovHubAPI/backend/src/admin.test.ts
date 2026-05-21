import assert from 'assert/strict';
import {
  computeApiKeyAccess,
  getDefaultApiKeyExpiry,
  normalizeExpiryInput,
  removeExistingSpecFiles,
} from './admin';

const now = new Date('2026-05-21T10:00:00.000Z');

assert.equal(getDefaultApiKeyExpiry(now).toISOString(), '2026-06-20T10:00:00.000Z');
assert.equal(normalizeExpiryInput(undefined, now), '2026-06-20T10:00:00.000Z');
assert.equal(normalizeExpiryInput('2026-05-22T10:00:00.000Z', now), '2026-05-22T10:00:00.000Z');
assert.throws(() => normalizeExpiryInput('2026-05-20T10:00:00.000Z', now), /future/);
assert.throws(() => normalizeExpiryInput('not-a-date', now), /valid ISO/);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-06',
    },
    'api-nira-01',
    now
  ),
  { allowed: true }
);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'REVOKED',
      api_key_expires_at: '2026-05-21T11:00:00.000Z',
      api_key_revoked_at: '2026-05-21T09:00:00.000Z',
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-06',
    },
    'api-nira-01',
    now
  ),
  { allowed: false, code: 'REVOKED_API_KEY', message: 'The provided API key has been revoked.' }
);

assert.deepEqual(
  computeApiKeyAccess(
    {
      status: 'APPROVED',
      api_key_status: 'ACTIVE',
      api_key_expires_at: '2026-05-21T09:59:59.000Z',
      api_key_revoked_at: null,
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-06',
    },
    'api-nira-01',
    now
  ),
  { allowed: false, code: 'EXPIRED_API_KEY', message: 'The provided API key has expired.' }
);

assert.deepEqual(removeExistingSpecFiles(['/openapi/a.yaml', '/openapi/a.yaml', null, '../bad.yaml']), [
  '/openapi/a.yaml',
]);

console.log('admin tests passed');
