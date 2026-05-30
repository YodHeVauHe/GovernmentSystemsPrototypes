import assert from 'assert';
import { canAccess, type AuthUser } from './auth';

function approvedAdmin(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'usr_admin',
    full_name: 'Admin User',
    email: 'admin@example.test',
    password_hash: 'scrypt:salt:hash',
    account_type: 'government_employee',
    requested_role: 'admin',
    requested_mda_id: 'mda-1',
    requested_organization: 'MoICT',
    requested_purpose: 'Administration',
    status: 'APPROVED',
    role: 'admin',
    mda_id: 'mda-1',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalRequireAdminMfa = process.env.GOVHUB_REQUIRE_ADMIN_MFA;

try {
  process.env.NODE_ENV = 'production';
  delete process.env.GOVHUB_REQUIRE_ADMIN_MFA;

  const decision = canAccess(approvedAdmin(), ['admin']);

  assert.deepStrictEqual(decision, {
    allowed: false,
    code: 'ADMIN_MFA_REQUIRED',
    message: 'Administrator multi-factor authentication is required before using privileged workflows.',
  });
} finally {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalRequireAdminMfa === undefined) delete process.env.GOVHUB_REQUIRE_ADMIN_MFA;
  else process.env.GOVHUB_REQUIRE_ADMIN_MFA = originalRequireAdminMfa;
}
