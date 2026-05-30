import assert from 'assert/strict';
import {
  hasValidationErrors,
  validateLoginForm,
  validateSignupForm,
} from './auth-validation';

const validSignup = {
  full_name: 'Jane Developer',
  email: 'jane.developer@example.go.ug',
  password: 'StrongPass123!',
  account_type: 'public_developer',
  requested_role: 'developer',
  requested_mda_id: '',
  requested_organization: 'Independent Civic Developer',
  requested_purpose: 'Build an approved public service integration.',
  turnstileToken: 'turnstile-token',
};

function run() {
  const loginErrors = validateLoginForm({
    email: 'not-an-email',
    password: '',
    mfaRequired: true,
    mfaCode: '12',
    turnstileToken: '',
  });
  assert.equal(loginErrors.email, 'Enter a valid email address.');
  assert.equal(loginErrors.password, 'Password is required.');
  assert.equal(loginErrors.mfaCode, 'Enter the 6-digit authenticator code.');
  assert.equal(loginErrors.turnstileToken, 'Complete the human verification challenge.');
  assert.equal(hasValidationErrors(loginErrors), true);

  assert.deepEqual(validateLoginForm({
    email: 'user@example.go.ug',
    password: 'StrongPass123!',
    mfaRequired: true,
    mfaCode: '123456',
    turnstileToken: 'turnstile-token',
  }), {});

  const signupErrors = validateSignupForm({
    ...validSignup,
    full_name: 'J',
    email: 'bad-email',
    password: 'weak',
    requested_organization: '',
    requested_purpose: 'Too short',
    turnstileToken: '',
  }, { requiresMda: false });
  assert.equal(signupErrors.full_name, 'Full legal name must be at least 2 characters.');
  assert.equal(signupErrors.email, 'Enter a valid email address.');
  assert.equal(signupErrors.password, 'Use at least 10 characters with uppercase, lowercase, a number, and a special character.');
  assert.equal(signupErrors.requested_organization, 'Organization or project name is required.');
  assert.equal(signupErrors.requested_purpose, 'Access purpose must be at least 20 characters.');
  assert.equal(signupErrors.turnstileToken, 'Complete the human verification challenge.');

  assert.equal(
    validateSignupForm({ ...validSignup, requested_mda_id: '' }, { requiresMda: true }).requested_mda_id,
    'Assigned MDA is required for this account category.'
  );

  assert.deepEqual(validateSignupForm(validSignup, { requiresMda: false }), {});
}

run();
console.log('auth validation tests passed');
