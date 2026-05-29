import assert from 'assert/strict';
import { normalizeSandboxLogPath } from './middleware/sandbox';

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

console.log('sandbox redaction tests passed');
