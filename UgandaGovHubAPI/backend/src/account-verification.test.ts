import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  ACCOUNT_TYPE_REQUIREMENTS,
  canSubmitVerification,
  ensureAccountVerificationSchema,
  getAccountSnapshot,
  getPrivilegeSummary,
  upsertVerificationDocument,
} from './account-verification';
import { ensureAuthSchema, hashPassword } from './auth';

const db = new Database(':memory:');
ensureAuthSchema(db);
ensureAccountVerificationSchema(db);

db.prepare(`
  INSERT INTO users (
    id, full_name, email, password_hash, account_type, requested_role,
    requested_mda_id, requested_organization, requested_purpose, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'usr_public',
  'Public Developer',
  'dev@example.com',
  hashPassword('StrongPass123!'),
  'public_developer',
  'developer',
  null,
  'Independent Developer',
  'Build a public service integration',
  'PENDING_REVIEW'
);

db.prepare(`
  INSERT INTO users (
    id, full_name, email, password_hash, account_type, requested_role,
    requested_mda_id, requested_organization, requested_purpose, status,
    role, mda_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'usr_gov',
  'MDA Officer',
  'officer@gov.go.ug',
  hashPassword('StrongPass123!'),
  'government_employee',
  'api_owner',
  'mda-01',
  'NIRA',
  'Manage identity APIs',
  'APPROVED',
  'api_owner',
  'mda-01'
);

assert.deepEqual(
  ACCOUNT_TYPE_REQUIREMENTS.public_developer.requiredDocuments.map((doc: { type: string }) => doc.type),
  ['national_id_front', 'national_id_back', 'nin_confirmation']
);
assert.deepEqual(
  ACCOUNT_TYPE_REQUIREMENTS.private_company.requiredDocuments.map((doc: { type: string }) => doc.type),
  ['certificate_of_incorporation', 'ursb_registration', 'ura_tin_certificate', 'authorization_letter']
);

let snapshot = getAccountSnapshot(db, 'usr_public');
assert.equal(snapshot?.profile.verification_status, 'draft_profile');
assert.equal(canSubmitVerification(snapshot!).allowed, false);
assert.equal(snapshot?.verification_progress.can_submit, false);
assert.equal(snapshot?.verification_progress.missing_fields.includes('National Identification Number'), true);
assert.equal(snapshot?.verification_progress.missing_documents.includes('nin_confirmation'), true);
assert.equal(snapshot?.verification_progress.next_action, 'complete_profile');

db.prepare(`
  UPDATE user_profiles SET
    nin = ?, national_id_number = ?, contact_phone = ?, address = ?
  WHERE user_id = ?
`).run('CM123456789ABCD', '000000001', '+256700000000', 'Kampala', 'usr_public');

upsertVerificationDocument(db, 'usr_public', {
  type: 'national_id_front',
  label: 'National ID front',
  file_name: 'front.png',
  mime_type: 'image/png',
  storage_ref: 'local/front.png',
});
upsertVerificationDocument(db, 'usr_public', {
  type: 'national_id_back',
  label: 'National ID back',
  file_name: 'back.png',
  mime_type: 'image/png',
  storage_ref: 'local/back.png',
});

snapshot = getAccountSnapshot(db, 'usr_public');
assert.equal(canSubmitVerification(snapshot!).allowed, false);
assert.match(canSubmitVerification(snapshot!).message || '', /nin_confirmation/);
assert.equal(snapshot?.verification_progress.can_submit, false);
assert.deepEqual(snapshot?.verification_progress.missing_documents, ['nin_confirmation']);

upsertVerificationDocument(db, 'usr_public', {
  type: 'nin_confirmation',
  label: 'NIN confirmation',
  file_name: 'nin.pdf',
  mime_type: 'application/pdf',
  storage_ref: 'local/nin.pdf',
});

snapshot = getAccountSnapshot(db, 'usr_public');
assert.equal(canSubmitVerification(snapshot!).allowed, true);
assert.equal(snapshot?.verification_progress.can_submit, true);
assert.equal(snapshot?.verification_progress.completed_requirements, snapshot?.verification_progress.total_requirements);
assert.equal(snapshot?.verification_progress.next_action, 'submit_for_review');

const privileges = getPrivilegeSummary(getAccountSnapshot(db, 'usr_gov')!.user);
assert.equal(privileges.accessGroup, 'Verified API Owner');
assert.equal(privileges.permissions.includes('Review API access requests for APIs owned by your MDA'), true);

console.log('account verification tests passed');
