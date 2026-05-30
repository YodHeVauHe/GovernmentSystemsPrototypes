import assert from 'assert/strict';
import {
  TURNSTILE_SITEVERIFY_URL,
  validateTurnstileToken,
} from './turnstile';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function run() {
  const originalAllowedHostnames = process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES;
  let capturedBody: any = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedBody = JSON.parse(String(init?.body || '{}'));
    return jsonResponse({ success: true, action: 'login', hostname: 'localhost' });
  };

  const success = await validateTurnstileToken({
    token: 'valid-turnstile-token',
    action: 'login',
    remoteIp: '127.0.0.1',
    secret: 'secret-key',
    fetchImpl,
  });
  assert.equal(success.ok, true);
  assert.equal(capturedBody.secret, 'secret-key');
  assert.equal(capturedBody.response, 'valid-turnstile-token');
  assert.equal(capturedBody.remoteip, '127.0.0.1');
  assert.equal(capturedBody.action, undefined);

  const missing = await validateTurnstileToken({
    token: '',
    action: 'login',
    secret: 'secret-key',
    fetchImpl,
  });
  assert.deepEqual(missing, {
    ok: false,
    status: 400,
    code: 'TURNSTILE_REQUIRED',
    message: 'Complete the human verification challenge before continuing.',
  });

  const invalid = await validateTurnstileToken({
    token: 'invalid-turnstile-token',
    action: 'signup',
    secret: 'secret-key',
    fetchImpl: async () => jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }),
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.code, 'TURNSTILE_FAILED');

  const actionMismatch = await validateTurnstileToken({
    token: 'valid-turnstile-token',
    action: 'signup',
    secret: 'secret-key',
    fetchImpl: async () => jsonResponse({ success: true, action: 'login' }),
  });
  assert.equal(actionMismatch.ok, false);
  assert.equal(actionMismatch.status, 400);
  assert.equal(actionMismatch.code, 'TURNSTILE_ACTION_MISMATCH');

  const missingAction = await validateTurnstileToken({
    token: 'valid-turnstile-token',
    action: 'login',
    secret: 'secret-key',
    fetchImpl: async () => jsonResponse({ success: true }),
  });
  assert.equal(missingAction.ok, false);
  assert.equal(missingAction.status, 400);
  assert.equal(missingAction.code, 'TURNSTILE_ACTION_MISMATCH');

  process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES = 'govhub.go.ug,localhost';
  try {
    const hostnameMismatch = await validateTurnstileToken({
      token: 'valid-turnstile-token',
      action: 'login',
      secret: 'secret-key',
      fetchImpl: async () => jsonResponse({ success: true, action: 'login', hostname: 'evil.example' }),
    });
    assert.equal(hostnameMismatch.ok, false);
    assert.equal(hostnameMismatch.status, 400);
    assert.equal(hostnameMismatch.code, 'TURNSTILE_HOSTNAME_MISMATCH');
  } finally {
    if (originalAllowedHostnames === undefined) {
      delete process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES;
    } else {
      process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES = originalAllowedHostnames;
    }
  }

  const testSecretAction = await validateTurnstileToken({
    token: 'dummy-turnstile-token',
    action: 'signup',
    secret: '1x0000000000000000000000000000000AA',
    fetchImpl: async () => jsonResponse({ success: true, action: 'test' }),
  });
  assert.equal(testSecretAction.ok, true);

  const skipped = await validateTurnstileToken({
    token: '',
    action: 'login',
    secret: null,
    fetchImpl,
  });
  assert.equal(skipped.ok, true);

  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const missingProductionSecret = await validateTurnstileToken({
      token: 'valid-turnstile-token',
      action: 'login',
      secret: null,
      fetchImpl,
    });
    assert.equal(missingProductionSecret.ok, false);
    assert.equal(missingProductionSecret.status, 503);
    assert.equal(missingProductionSecret.code, 'TURNSTILE_NOT_CONFIGURED');
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }

  assert.equal(TURNSTILE_SITEVERIFY_URL, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
}

run()
  .then(() => console.log('turnstile tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
