import { isCloudflareTestTurnstileSecret } from './turnstile';

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production';
}

export function isDemoModeEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.GOVHUB_DEMO_MODE === 'true';
}

export function shouldRequireAdminMfa(env: NodeJS.ProcessEnv = process.env) {
  return isProductionEnv(env) || env.GOVHUB_REQUIRE_ADMIN_MFA === 'true';
}

function parseCsvEnv(value: string | undefined) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseOrigin(origin: string) {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function isLocalhostHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

function isLocalhostOrigin(origin: string) {
  const parsed = parseOrigin(origin);
  return parsed ? isLocalhostHostname(parsed.hostname) : false;
}

function isValidProductionCorsOrigin(origin: string) {
  const parsed = parseOrigin(origin);
  if (!parsed) return false;
  const isOriginOnly = origin === parsed.origin || origin === `${parsed.origin}/`;
  return parsed.protocol === 'https:'
    && !parsed.username
    && !parsed.password
    && parsed.pathname === '/'
    && !parsed.search
    && !parsed.hash
    && isOriginOnly;
}

function isValidProductionDataEncryptionKey(value: string | undefined) {
  const key = value?.trim() || '';
  if (/^[a-f0-9]{64}$/i.test(key)) return true;
  if (!/^[A-Za-z0-9+/]{43}=?$/.test(key)) return false;

  const paddedKey = key.length === 43 ? `${key}=` : key;

  try {
    const decoded = Buffer.from(paddedKey, 'base64');
    return decoded.length === 32 && decoded.toString('base64') === paddedKey;
  } catch {
    return false;
  }
}

export function validateProductionSecurityEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!isProductionEnv(env)) return;

  if (isDemoModeEnabled(env)) {
    throw new Error('GOVHUB_DEMO_MODE must be disabled in production.');
  }
  if (!env.GOVHUB_DATA_ENCRYPTION_KEY) {
    throw new Error('GOVHUB_DATA_ENCRYPTION_KEY is required in production.');
  }
  if (!isValidProductionDataEncryptionKey(env.GOVHUB_DATA_ENCRYPTION_KEY)) {
    throw new Error('GOVHUB_DATA_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or canonical base64 in production.');
  }
  if (!env.GOVHUB_ADMIN_PASSWORD) {
    throw new Error('GOVHUB_ADMIN_PASSWORD is required in production.');
  }
  if (env.GOVHUB_REQUIRE_ADMIN_MFA !== 'true') {
    throw new Error('GOVHUB_REQUIRE_ADMIN_MFA=true is required in production.');
  }
  if (env.DATABASE_SSL === 'false') {
    throw new Error('DATABASE_SSL=false is not allowed in production.');
  }
  if (env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production.');
  }
  if (env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS === 'true') {
    throw new Error('GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true is not allowed in production.');
  }
  const turnstileSecret = env.GOVHUB_TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET_KEY;
  if (!turnstileSecret) {
    throw new Error('GOVHUB_TURNSTILE_SECRET_KEY or TURNSTILE_SECRET_KEY is required in production.');
  }
  if (isCloudflareTestTurnstileSecret(turnstileSecret)) {
    throw new Error('Cloudflare Turnstile test secrets are not allowed in production.');
  }
  const allowedTurnstileHostnames = parseCsvEnv(env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES);
  if (allowedTurnstileHostnames.length === 0) {
    throw new Error('GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES is required in production.');
  }
  const allowedOrigins = parseCsvEnv(env.GOVHUB_ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    throw new Error('GOVHUB_ALLOWED_ORIGINS is required in production.');
  }
  if (allowedOrigins.some(isLocalhostOrigin)) {
    throw new Error('localhost origins are not allowed in production CORS configuration.');
  }
  if (allowedOrigins.some(origin => !isValidProductionCorsOrigin(origin))) {
    throw new Error('GOVHUB_ALLOWED_ORIGINS must contain valid HTTPS origins in production.');
  }
}
