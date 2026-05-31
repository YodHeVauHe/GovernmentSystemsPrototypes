import assert from 'node:assert/strict';
import { validateProductionSecurityEnv } from './security-config';

function validProductionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_ADMIN_PASSWORD: '***REMOVED***',
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: 'production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.com',
    GOVHUB_ALLOWED_ORIGINS: 'https://govhub.example.com',
    ...overrides,
  };
}

assert.doesNotThrow(() => validateProductionSecurityEnv(validProductionEnv({
  GOVHUB_DEMO_MODE: 'true',
  GOVHUB_DEMO_DEVELOPER_PASSWORD: '***REMOVED***',
  GOVHUB_DEMO_API_OWNER_PASSWORD: '***REMOVED***',
  GOVHUB_DEMO_REVIEWER_PASSWORD: '***REMOVED***',
})));

assert.throws(
  () => validateProductionSecurityEnv(validProductionEnv({
    GOVHUB_DEMO_MODE: 'true',
    GOVHUB_DEMO_API_OWNER_PASSWORD: '***REMOVED***',
    GOVHUB_DEMO_REVIEWER_PASSWORD: '***REMOVED***',
  })),
  /GOVHUB_DEMO_DEVELOPER_PASSWORD is required when GOVHUB_DEMO_MODE=true in production\./
);

console.log('security-config tests passed');
