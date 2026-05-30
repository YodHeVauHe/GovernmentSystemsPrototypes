export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const HUMAN_VERIFICATION_STORAGE_KEY = 'govhub:human-verification:v1';

export function isServerVerificationBypassEnabled(value: string | boolean | undefined) {
  return value === true || value === 'true';
}

export function getTurnstileSiteKey() {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY || TURNSTILE_TEST_SITE_KEY;
}

export function shouldBypassTurnstileServerVerification() {
  return isServerVerificationBypassEnabled(import.meta.env.VITE_TURNSTILE_SKIP_SERVER_VERIFY);
}
