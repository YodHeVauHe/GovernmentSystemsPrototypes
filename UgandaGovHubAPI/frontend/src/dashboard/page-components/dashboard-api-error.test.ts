import assert from 'node:assert/strict';
import {
  createDashboardApiError,
  DashboardApiError,
  getDashboardErrorCode,
  isAdminMfaRequiredError,
} from './dashboard-api-error';

const adminMfaError = new DashboardApiError(
  '/api/admin/users',
  403,
  'Administrator multi-factor authentication is required before using privileged workflows.',
  'ADMIN_MFA_REQUIRED'
);

assert.equal(getDashboardErrorCode(adminMfaError), 'ADMIN_MFA_REQUIRED');
assert.equal(isAdminMfaRequiredError(adminMfaError), true);

const genericError = new Error('Failed to load dashboard data.');
assert.equal(getDashboardErrorCode(genericError), undefined);
assert.equal(isAdminMfaRequiredError(genericError), false);

const responseError = createDashboardApiError('/api/admin/users', 403, {
  error: 'Administrator multi-factor authentication is required before using privileged workflows.',
  code: 'ADMIN_MFA_REQUIRED',
});

assert.equal(responseError.message, 'Administrator multi-factor authentication is required before using privileged workflows.');
assert.equal(responseError.code, 'ADMIN_MFA_REQUIRED');
assert.equal(responseError.path, '/api/admin/users');
assert.equal(responseError.status, 403);
