import assert from 'assert/strict';
import {
  ACCOUNT_TYPE_REQUIREMENTS,
  getVerificationProgress,
  type AccountProfile,
  type VerificationDocument,
} from './account-verification';

const profile = {
  user_id: 'usr_progress',
  verification_status: 'draft_profile',
  account_category: 'public_developer',
  nin: 'CM123456789ABCD',
  national_id_number: '000000001',
  contact_phone: '+256700000000',
  address: 'Kampala',
  organization_name: 'Independent Developer',
  organization_type: null,
  ursb_number: null,
  brn: null,
  tin: null,
  staff_id: null,
  department: null,
  job_title: null,
  supervisor_name: null,
  supervisor_email: null,
  review_notes: null,
  submitted_at: null,
} satisfies AccountProfile;

function document(type: string, status: string): VerificationDocument {
  return {
    id: `doc_${type}`,
    user_id: profile.user_id,
    type,
    label: type,
    file_name: `${type}.pdf`,
    mime_type: 'application/pdf',
    storage_ref: `metadata://${profile.user_id}/${type}.pdf`,
    status,
    uploaded_at: new Date(0).toISOString(),
  };
}

const progress = getVerificationProgress(profile, [
  document('national_id_front', 'submitted'),
  document('national_id_back', 'rejected'),
  document('nin_confirmation', 'submitted'),
], ACCOUNT_TYPE_REQUIREMENTS.public_developer);

assert.equal(progress.can_submit, false);
assert.equal(progress.completed_documents, 2);
assert.deepEqual(progress.missing_documents, ['national_id_back']);

console.log('account verification progress tests passed');
