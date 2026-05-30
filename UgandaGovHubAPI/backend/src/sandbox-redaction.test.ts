import assert from 'assert/strict';
import { normalizeSandboxLogPath, redactSandboxLogValue } from './middleware/sandbox';

const sensitivePathExamples = [
  ['/api/v1/identity/status/CM123456789012', '/api/v1/identity/status/[REDACTED]'],
  ['/api/v1/tax/tin-status/1000123456', '/api/v1/tax/tin-status/[REDACTED]'],
  ['/api/v1/tax/clearance/1000123456', '/api/v1/tax/clearance/[REDACTED]'],
  ['/api/v1/tax/filing-obligations/1000123456', '/api/v1/tax/filing-obligations/[REDACTED]'],
  ['/api/v1/business/registration/80010001234567', '/api/v1/business/registration/[REDACTED]'],
  ['/api/v1/business/company-status/C-2024-001245', '/api/v1/business/company-status/[REDACTED]'],
  ['/api/v1/business/beneficial-ownership/80010001234567', '/api/v1/business/beneficial-ownership/[REDACTED]'],
  ['/api/v1/transport/driving-permit/status/WP30219', '/api/v1/transport/driving-permit/status/[REDACTED]'],
  ['/api/v1/transport/driving-permit/classes/WP30219', '/api/v1/transport/driving-permit/classes/[REDACTED]'],
  ['/api/v1/service-uganda/cases/case-2026-000145', '/api/v1/service-uganda/cases/[REDACTED]'],
];

for (const [rawPath, expectedPath] of sensitivePathExamples) {
  assert.equal(normalizeSandboxLogPath(rawPath), expectedPath);
}

assert.equal(
  normalizeSandboxLogPath('/api/v1/tax/tin-status/1000123456?tin=1000123456&status=valid'),
  '/api/v1/tax/tin-status/[REDACTED]?tin=%5BREDACTED%5D&status=valid'
);

assert.equal(
  normalizeSandboxLogPath('/api/v1/identity/verify?access_token=secret-token&clientSecret=top-secret&private_key=private&status=valid'),
  '/api/v1/identity/verify?access_token=%5BREDACTED%5D&clientSecret=%5BREDACTED%5D&private_key=%5BREDACTED%5D&status=valid'
);

assert.equal(
  normalizeSandboxLogPath('/api/v1/business/beneficial-ownership?brn=BRN12345&permit_number=WP30219&status=valid'),
  '/api/v1/business/beneficial-ownership?brn=%5BREDACTED%5D&permit_number=%5BREDACTED%5D&status=valid'
);

assert.deepEqual(
  redactSandboxLogValue({
    auth: {
      access_token: 'secret-token',
      refreshToken: 'refresh-token',
      clientSecret: 'client-secret',
      apiKey: 'api-key',
      private_key: 'private-key',
      accessKey: 'access-key',
      signing_key: 'signing-key',
    },
    ordinary: 'keep',
  }),
  {
    auth: {
      access_token: '[REDACTED]',
      refreshToken: '[REDACTED]',
      clientSecret: '[REDACTED]',
      apiKey: '[REDACTED]',
      private_key: '[REDACTED]',
      accessKey: '[REDACTED]',
      signing_key: '[REDACTED]',
    },
    ordinary: 'keep',
  }
);

assert.deepEqual(
  redactSandboxLogValue({
    brn: 'BRN12345',
    permit_number: 'WP30219',
    permitNumber: 'WP30220',
    profile: {
      national_id_number: 'CM123456789012',
      card_number: '000012345',
      ursb_number: 'URS-BRN-0001',
    },
    ordinary: 'keep',
  }),
  {
    brn: '[REDACTED]',
    permit_number: '[REDACTED]',
    permitNumber: '[REDACTED]',
    profile: {
      national_id_number: '[REDACTED]',
      card_number: '[REDACTED]',
      ursb_number: '[REDACTED]',
    },
    ordinary: 'keep',
  }
);

console.log('sandbox redaction tests passed');
