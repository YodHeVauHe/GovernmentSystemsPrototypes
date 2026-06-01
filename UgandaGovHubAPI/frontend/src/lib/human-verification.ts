export const DEFAULT_HUMAN_VERIFICATION_TIMEOUT_MS = 12_000;

interface FetchHumanVerificationInput {
  apiBase: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function timeoutMessage() {
  return 'Human verification took too long. Please retry the challenge.';
}

export async function fetchHumanVerification({
  apiBase,
  token,
  timeoutMs = DEFAULT_HUMAN_VERIFICATION_TIMEOUT_MS,
  fetchImpl = fetch,
}: FetchHumanVerificationInput) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${apiBase}/api/auth/human-verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ turnstile_token: token }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Human verification failed. Please retry the challenge.');
    }
    return body;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(timeoutMessage());
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
