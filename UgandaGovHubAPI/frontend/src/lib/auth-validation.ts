const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_UPPERCASE_RE = /[A-Z]/;
const PASSWORD_LOWERCASE_RE = /[a-z]/;
const PASSWORD_DIGIT_RE = /[0-9]/;
const PASSWORD_SYMBOL_RE = /[^A-Za-z0-9]/;

export type LoginValidationErrors = Partial<Record<'email' | 'password' | 'mfaCode' | 'turnstileToken', string>>;
export type SignupValidationErrors = Partial<Record<
  | 'full_name'
  | 'email'
  | 'password'
  | 'requested_mda_id'
  | 'requested_organization'
  | 'requested_purpose'
  | 'turnstileToken',
  string
>>;

interface LoginValidationInput {
  email: string;
  password: string;
  mfaRequired: boolean;
  mfaCode: string;
  turnstileToken: string;
}

interface SignupValidationInput {
  full_name: string;
  email: string;
  password: string;
  requested_mda_id: string | null;
  requested_organization: string;
  requested_purpose: string;
  turnstileToken: string;
}

export function hasValidationErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

export function validateLoginForm(input: LoginValidationInput): LoginValidationErrors {
  const errors: LoginValidationErrors = {};
  const email = input.email.trim();

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!input.password) {
    errors.password = 'Password is required.';
  }
  if (input.mfaRequired && !/^\d{6}$/.test(input.mfaCode)) {
    errors.mfaCode = 'Enter the 6-digit authenticator code.';
  }
  if (!input.turnstileToken) {
    errors.turnstileToken = 'Complete the human verification challenge.';
  }

  return errors;
}

export function validateSignupForm(
  input: SignupValidationInput,
  options: { requiresMda: boolean }
): SignupValidationErrors {
  const errors: SignupValidationErrors = {};
  const fullName = input.full_name.trim();
  const email = input.email.trim();
  const organization = input.requested_organization.trim();
  const purpose = input.requested_purpose.trim();

  if (fullName.length < 2) {
    errors.full_name = 'Full legal name must be at least 2 characters.';
  }
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (
    input.password.length < 10 ||
    !PASSWORD_UPPERCASE_RE.test(input.password) ||
    !PASSWORD_LOWERCASE_RE.test(input.password) ||
    !PASSWORD_DIGIT_RE.test(input.password) ||
    !PASSWORD_SYMBOL_RE.test(input.password)
  ) {
    errors.password = 'Use at least 10 characters with uppercase, lowercase, a number, and a special character.';
  }
  if (options.requiresMda && !input.requested_mda_id) {
    errors.requested_mda_id = 'Assigned MDA is required for this account category.';
  }
  if (!organization) {
    errors.requested_organization = 'Organization or project name is required.';
  }
  if (purpose.length < 20) {
    errors.requested_purpose = 'Access purpose must be at least 20 characters.';
  }
  if (!input.turnstileToken) {
    errors.turnstileToken = 'Complete the human verification challenge.';
  }

  return errors;
}
