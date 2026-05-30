import assert from 'assert/strict';
import { computeApiKeyAccess } from './admin';

const now = new Date('2026-05-21T10:00:00.000Z');

const approvedRecord = {
  status: 'APPROVED',
  api_key_status: 'ACTIVE',
  api_key_expires_at: '2026-05-21T11:00:00.000Z',
  api_key_revoked_at: null,
  api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
  consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
};

assert.deepEqual(
  computeApiKeyAccess(approvedRecord, approvedRecord.api_id, now),
  { allowed: true }
);

assert.deepEqual(
  computeApiKeyAccess({
    ...approvedRecord,
    api_key_expires_at: 'not-a-date',
  }, approvedRecord.api_id, now),
  {
    allowed: false,
    code: 'INVALID_API_KEY',
    message: 'The provided API key expiry is invalid.',
  }
);

assert.deepEqual(
  computeApiKeyAccess({
    ...approvedRecord,
    api_key_status: 'PAUSED',
  }, approvedRecord.api_id, now),
  {
    allowed: false,
    code: 'INVALID_API_KEY',
    message: 'The provided API key status is invalid.',
  }
);

console.log('API key access tests passed');
