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

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'password',
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    GOVHUB_ALLOWED_ORIGINS: 'https://govhub.example.go.ug',
  } as NodeJS.ProcessEnv),
  /GOVHUB_DATA_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or canonical base64 in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'not-base64-not-base64-not-base64-not-base64',
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    GOVHUB_ALLOWED_ORIGINS: 'https://govhub.example.go.ug',
  } as NodeJS.ProcessEnv),
  /GOVHUB_DATA_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or canonical base64 in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  } as NodeJS.ProcessEnv),
  /Cloudflare Turnstile test secrets are not allowed in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
  } as NodeJS.ProcessEnv),
  /GOVHUB_TURNSTILE_SECRET_KEY or TURNSTILE_SECRET_KEY is required in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
  } as NodeJS.ProcessEnv),
  /GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES is required in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    DATABASE_SSL: 'false',
  } as NodeJS.ProcessEnv),
  /DATABASE_SSL=false is not allowed in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
  } as NodeJS.ProcessEnv),
  /DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    GOVHUB_ALLOW_UNLISTED_SPEC_URLS: 'true',
  } as NodeJS.ProcessEnv),
  /GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true is not allowed in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
  } as NodeJS.ProcessEnv),
  /GOVHUB_ALLOWED_ORIGINS is required in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    GOVHUB_ALLOWED_ORIGINS: 'https://govhub.example.go.ug,http://localhost:5173',
  } as NodeJS.ProcessEnv),
  /localhost origins are not allowed in production CORS configuration/
);

assert.throws(
  () => validateProductionSecurityEnv({
    NODE_ENV: 'production',
    GOVHUB_DEMO_MODE: 'false',
    GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
    GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
    GOVHUB_REQUIRE_ADMIN_MFA: 'true',
    GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
    GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
    GOVHUB_ALLOWED_ORIGINS: 'http://govhub.example.go.ug',
  } as NodeJS.ProcessEnv),
  /GOVHUB_ALLOWED_ORIGINS must contain valid HTTPS origins in production/
);

assert.throws(
  () => validateProductionSecurityEnv({
  NODE_ENV: 'production',
  GOVHUB_DEMO_MODE: 'true',
  GOVHUB_ADMIN_PASSWORD: 'AdminPass123!',
  GOVHUB_DATA_ENCRYPTION_KEY: 'a'.repeat(64),
  GOVHUB_REQUIRE_ADMIN_MFA: 'true',
  GOVHUB_TURNSTILE_SECRET_KEY: '0xrealistic-production-turnstile-secret',
  GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES: 'govhub.example.go.ug',
  GOVHUB_ALLOWED_ORIGINS: 'https://govhub.example.go.ug',
} as NodeJS.ProcessEnv),
  /GOVHUB_DEMO_MODE=true is not allowed in production/
);
