import assert from 'assert';
import { validateTurnstileToken } from './turnstile';

async function runTurnstileSecurityTests() {
  const originalTimeout = process.env.GOVHUB_TURNSTILE_TIMEOUT_MS;

  try {
    process.env.GOVHUB_TURNSTILE_TIMEOUT_MS = '1';

    let observedSignal: AbortSignal | undefined;
    let observedAbort = false;

    const result = await validateTurnstileToken({
      token: 'valid-turnstile-token',
      action: 'login',
      secret: '0xrealistic-turnstile-secret',
      fetchImpl: async (_url, init) => {
        observedSignal = init?.signal || undefined;
        if (!observedSignal) {
          return {
            json: async () => ({ success: true, action: 'login', hostname: 'govhub.example.test' }),
          } as Response;
        }

        await new Promise<void>(resolve => {
          observedSignal!.addEventListener('abort', () => {
            observedAbort = true;
            resolve();
          }, { once: true });
        });
        throw new Error('siteverify request aborted');
      },
    });

    assert.ok(
      observedSignal,
      'Turnstile siteverify requests must include an AbortSignal so stalled upstream calls cannot hold login/signup requests indefinitely.'
    );
    assert.ok(observedAbort, 'Turnstile siteverify requests must abort after the configured timeout.');
    assert.deepStrictEqual(result, {
      ok: false,
      status: 503,
      code: 'TURNSTILE_UNAVAILABLE',
      message: 'Human verification is temporarily unavailable. Please try again.',
    });
  } finally {
    if (originalTimeout === undefined) delete process.env.GOVHUB_TURNSTILE_TIMEOUT_MS;
    else process.env.GOVHUB_TURNSTILE_TIMEOUT_MS = originalTimeout;
  }
}

runTurnstileSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
