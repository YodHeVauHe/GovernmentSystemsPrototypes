import assert from 'node:assert/strict';
import {
  isDeleteConfirmationMatch,
  sanitizeReviewPromptText,
  validateAccountApprovalInput,
} from './account-review-validation';

assert.deepEqual(
  validateAccountApprovalInput({ role: 'reviewer', needsMda: true, mdaId: '   ' }),
  { ok: false, message: 'Select a valid MDA before approving this account.' },
);

assert.deepEqual(
  validateAccountApprovalInput({ role: 'developer', needsMda: false, mdaId: 'junk value' }),
  { ok: true, role: 'developer', mdaId: null },
);

assert.deepEqual(
  validateAccountApprovalInput({ role: 'admin', needsMda: true, mdaId: 'mda-moict-1' }),
  { ok: true, role: 'admin', mdaId: 'mda-moict-1' },
);

assert.equal(sanitizeReviewPromptText('  Missing authorization letter  '), 'Missing authorization letter');
assert.equal(sanitizeReviewPromptText('Bad\u0000text'), null);

assert.equal(isDeleteConfirmationMatch('DELETE', 'Harold Mujuliwa'), true);
assert.equal(isDeleteConfirmationMatch('  harold mujuliwa  ', 'Harold Mujuliwa'), true);
assert.equal(isDeleteConfirmationMatch('Harold', 'Harold Mujuliwa'), false);
