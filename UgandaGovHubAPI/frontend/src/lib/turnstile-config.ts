export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const HUMAN_VERIFICATION_STORAGE_KEY = 'govhub:human-verification:v1';

interface TurnstileEnv {
  PROD?: boolean;
  TURNSTILE_SITE_KEY?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  VITE_TURNSTILE_SKIP_SERVER_VERIFY?: string | boolean;
}

export function isServerVerificationBypassEnabled(value: string | boolean | undefined) {
  return value === true || value === 'true';
}

export function resolveTurnstileSiteKey(env: TurnstileEnv) {
  const siteKey = env.VITE_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY;
  if (siteKey && (!env.PROD || siteKey !== TURNSTILE_TEST_SITE_KEY)) {
    return siteKey;
  }
  if (env.PROD) {
    throw new Error('A real TURNSTILE_SITE_KEY is required in production.');
  }
  return TURNSTILE_TEST_SITE_KEY;
}

export function getTurnstileSiteKey() {
  return resolveTurnstileSiteKey(import.meta.env);
}

export function shouldBypassTurnstileServerVerification() {
  return isServerVerificationBypassEnabled(import.meta.env.VITE_TURNSTILE_SKIP_SERVER_VERIFY);
}
