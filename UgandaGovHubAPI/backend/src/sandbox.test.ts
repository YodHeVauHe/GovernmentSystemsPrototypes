import assert from 'assert/strict';
import { redactSandboxLogValue, normalizeSandboxLogPath } from './middleware/sandbox';

assert.deepEqual(
  redactSandboxLogValue({
    person: {
      nin: 'CM123456789012',
      details: [{ tin: '1000123456' }],
    },
    password: 'SecretPass123!',
    ordinary: 'keep',
  }),
  {
    person: {
      nin: 'CM12******12',
      details: [{ tin: '10****56' }],
    },
    password: '[REDACTED]',
    ordinary: 'keep',
  }
);

assert.equal(
  normalizeSandboxLogPath('/api/v1/identity/verify?nin=CM123456789012&tin=1000123456&status=valid'),
  '/api/v1/identity/verify?nin=%5BREDACTED%5D&tin=%5BREDACTED%5D&status=valid'
);

console.log('sandbox tests passed');
