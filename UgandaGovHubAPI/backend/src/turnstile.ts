import crypto from 'crypto';

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLOUDFLARE_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

type TurnstileAction = 'app_load' | 'login' | 'signup';

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export type TurnstileValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      errors?: string[];
    };

interface ValidateTurnstileTokenInput {
  token: string | null | undefined;
  action: TurnstileAction;
  remoteIp?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
}

export function configuredTurnstileSecret() {
  return process.env.GOVHUB_TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY || null;
}

function configuredTurnstileAllowedHostnames() {
  return (process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map(hostname => hostname.trim().toLowerCase())
    .filter(Boolean);
}

export async function validateTurnstileToken({
  token,
  action,
  remoteIp,
  secret = configuredTurnstileSecret(),
  fetchImpl = fetch,
}: ValidateTurnstileTokenInput): Promise<TurnstileValidationResult> {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        status: 503,
        code: 'TURNSTILE_NOT_CONFIGURED',
        message: 'Human verification is not configured. Contact an administrator.',
      };
    }
    return { ok: true };
  }

  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  if (!normalizedToken) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_REQUIRED',
      message: 'Complete the human verification challenge before continuing.',
    };
  }
  if (normalizedToken.length > 2048) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_INVALID',
      message: 'The human verification token is invalid. Please try again.',
    };
  }

  let result: SiteverifyResponse;
  try {
    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: normalizedToken,
        remoteip: remoteIp || undefined,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    result = await response.json() as SiteverifyResponse;
  } catch {
    return {
      ok: false,
      status: 503,
      code: 'TURNSTILE_UNAVAILABLE',
      message: 'Human verification is temporarily unavailable. Please try again.',
    };
  }

  if (!result.success) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_FAILED',
      message: 'Human verification failed. Please retry the challenge.',
      errors: result['error-codes'] || [],
    };
  }

  const isCloudflareTestSecret = CLOUDFLARE_TEST_SECRET_KEYS.has(secret);
  if (!isCloudflareTestSecret && result.action !== action) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_ACTION_MISMATCH',
      message: 'Human verification could not be matched to this request. Please retry the challenge.',
    };
  }

  const allowedHostnames = configuredTurnstileAllowedHostnames();
  const verifiedHostname = String(result.hostname || '').trim().toLowerCase();
  if (!isCloudflareTestSecret && allowedHostnames.length && !allowedHostnames.includes(verifiedHostname)) {
    return {
      ok: false,
      status: 400,
      code: 'TURNSTILE_HOSTNAME_MISMATCH',
      message: 'Human verification could not be matched to this site. Please retry the challenge.',
    };
  }

  return { ok: true };
}
