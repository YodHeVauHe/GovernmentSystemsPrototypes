import assert from 'assert';
import { shouldRequireAdminMfa, validateProductionSecurityEnv } from './security-config';

assert.equal(shouldRequireAdminMfa({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), true);
assert.equal(shouldRequireAdminMfa({ GOVHUB_REQUIRE_ADMIN_MFA: 'true' } as NodeJS.ProcessEnv), true);
assert.equal(shouldRequireAdminMfa({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), false);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
  } as NodeJS.ProcessEnv),
  /GOVHUB_REQUIRE_ADMIN_MFA=true is required in production/
);

assert.doesNotThrow(() => validateProductionSecurityEnv({
  NODE_ENV: 'production',
  GOVHUB_DEMO_MODE: 'true',
  GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
  GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
  GOVHUB_REQUIRE_ADMIN_MFA: 'true',
} as NodeJS.ProcessEnv));
