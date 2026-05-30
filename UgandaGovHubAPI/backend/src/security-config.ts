export function isProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production';
}

export function isDemoModeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.GOVHUB_DEMO_MODE === 'true';
}

export function shouldRequireAdminMfa(env: NodeJS.ProcessEnv = process.env) {
  return isProductionEnv(env) || env.GOVHUB_REQUIRE_ADMIN_MFA === 'true';
}

export function validateProductionSecurityEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!isProductionEnv(env)) return;

  if (!env.GOVHUB_DATA_ENCRYPTION_KEY) {
    throw new Error('GOVHUB_DATA_ENCRYPTION_KEY is required in production.');
  }
  if (!env.GOVHUB_ADMIN_PASSWORD) {
    throw new Error('GOVHUB_ADMIN_PASSWORD is required in production.');
  }
  if (env.GOVHUB_REQUIRE_ADMIN_MFA !== 'true') {
    throw new Error('GOVHUB_REQUIRE_ADMIN_MFA=true is required in production.');
  }
}
