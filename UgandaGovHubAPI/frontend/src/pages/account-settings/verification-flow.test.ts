import assert from 'node:assert/strict';
import { resolveNextVerificationTab } from './verification-flow';
import type { AccountSnapshot } from './types';

function accountSnapshot(overrides: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    user: {} as AccountSnapshot['user'],
    profile: {
      verification_status: 'draft_profile',
      account_category: 'private_company',
    },
    documents: [],
    requirements: {
      label: 'Private Company',
      description: 'Company verification',
      requiredFields: [
        { key: 'organization_name', label: 'Company name' },
        { key: 'tin', label: 'URA TIN' },
        { key: 'nin', label: 'Authorized representative NIN' },
      ],
      requiredDocuments: [
        { type: 'certificate_of_incorporation', label: 'Certificate of incorporation', accepts: 'application/pdf' },
      ],
    },
    privileges: {
      accessGroup: 'Applicant',
      permissions: [],
      restrictions: [],
    },
    verification_progress: {
      missing_fields: [],
      missing_documents: [],
      completed_requirements: 0,
      total_requirements: 4,
      can_submit: false,
      next_action: 'complete_profile',
      message: 'Complete verification',
    },
    ...overrides,
  };
}

assert.equal(
  resolveNextVerificationTab(accountSnapshot({
    verification_progress: {
      missing_fields: ['Authorized representative NIN', 'Company name'],
      missing_documents: ['Certificate of incorporation'],
      completed_requirements: 0,
      total_requirements: 4,
      can_submit: false,
      next_action: 'complete_profile',
      message: 'Complete profile first',
    },
  })),
  'profile',
);

assert.equal(
  resolveNextVerificationTab(accountSnapshot({
    verification_progress: {
      missing_fields: ['Company name', 'URA TIN'],
      missing_documents: ['Certificate of incorporation'],
      completed_requirements: 1,
      total_requirements: 4,
      can_submit: false,
      next_action: 'complete_profile',
      message: 'Complete organization details',
    },
  })),
  'organization',
);

assert.equal(
  resolveNextVerificationTab(accountSnapshot({
    verification_progress: {
      missing_fields: [],
      missing_documents: ['Certificate of incorporation'],
      completed_requirements: 3,
      total_requirements: 4,
      can_submit: false,
      next_action: 'upload_documents',
      message: 'Upload documents',
    },
  })),
  'documents',
);

assert.equal(
  resolveNextVerificationTab(accountSnapshot({
    verification_progress: {
      missing_fields: [],
      missing_documents: [],
      completed_requirements: 4,
      total_requirements: 4,
      can_submit: true,
      next_action: 'submit_for_review',
      message: 'Ready to submit',
    },
  })),
  'documents',
);
