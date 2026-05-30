import assert from 'assert/strict';
import {
  ACCOUNT_TYPE_REQUIREMENTS,
  canSubmitVerification,
  ensureAccountVerificationSchema,
  getAccountSnapshot,
  getPrivilegeSummary,
  upsertVerificationDocument,
} from './account-verification';
import { ensureAuthSchema, hashPassword } from './auth';
import { withPostgresTestDb } from './postgres-test-db';

async function main() {
  await withPostgresTestDb(async db => {
    await ensureAuthSchema(db);

    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_test_public',
      'Public Developer',
      'dev.test@example.com',
      hashPassword('StrongPass123!'),
      'public_developer',
      'developer',
      null,
      'Independent Developer',
      'Build a public service integration',
      'PENDING_REVIEW'
    );

    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status,
        role, mda_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'usr_test_gov',
      'MDA Officer',
      'officer.test@gov.go.ug',
      hashPassword('StrongPass123!'),
      'government_employee',
      'api_owner',
      'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41',
      'NIRA',
      'Manage identity APIs',
      'APPROVED',
      'api_owner',
      'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41'
    );

    await ensureAccountVerificationSchema(db);

    assert.deepEqual(
      ACCOUNT_TYPE_REQUIREMENTS.public_developer.requiredDocuments.map((doc: { type: string }) => doc.type),
      ['national_id_front', 'national_id_back', 'nin_confirmation']
    );
    assert.deepEqual(
      ACCOUNT_TYPE_REQUIREMENTS.private_company.requiredDocuments.map((doc: { type: string }) => doc.type),
      ['certificate_of_incorporation', 'ursb_registration', 'ura_tin_certificate', 'authorization_letter']
    );

    let snapshot = await getAccountSnapshot(db, 'usr_test_public');
    assert.equal(snapshot?.profile.verification_status, 'draft_profile');
    assert.equal(canSubmitVerification(snapshot!).allowed, false);
    assert.equal(snapshot?.verification_progress.can_submit, false);
    assert.equal(snapshot?.verification_progress.missing_fields.includes('National Identification Number'), true);
    assert.equal(snapshot?.verification_progress.missing_documents.includes('nin_confirmation'), true);
    assert.equal(snapshot?.verification_progress.next_action, 'complete_profile');

    await db.prepare(`
      UPDATE user_profiles SET
        nin = ?, national_id_number = ?, contact_phone = ?, address = ?
      WHERE user_id = ?
    `).run('CM123456789ABCD', '000000001', '+256700000000', 'Kampala', 'usr_test_public');

    await upsertVerificationDocument(db, 'usr_test_public', {
      type: 'national_id_front',
      label: 'National ID front',
      file_name: 'front.png',
      mime_type: 'image/png',
      storage_ref: 'local/front.png',
    });
    await upsertVerificationDocument(db, 'usr_test_public', {
      type: 'national_id_back',
      label: 'National ID back',
      file_name: 'back.png',
      mime_type: 'image/png',
      storage_ref: 'local/back.png',
    });

    snapshot = await getAccountSnapshot(db, 'usr_test_public');
    assert.equal(canSubmitVerification(snapshot!).allowed, false);
    assert.match(canSubmitVerification(snapshot!).message || '', /nin_confirmation/);
    assert.equal(snapshot?.verification_progress.can_submit, false);
    assert.deepEqual(snapshot?.verification_progress.missing_documents, ['nin_confirmation']);

    await upsertVerificationDocument(db, 'usr_test_public', {
      type: 'nin_confirmation',
      label: 'NIN confirmation',
      file_name: 'nin.pdf',
      mime_type: 'application/pdf',
      storage_ref: 'local/nin.pdf',
    });

    snapshot = await getAccountSnapshot(db, 'usr_test_public');
    assert.equal(canSubmitVerification(snapshot!).allowed, true);
    assert.equal(snapshot?.verification_progress.can_submit, true);
    assert.equal(snapshot?.verification_progress.completed_requirements, snapshot?.verification_progress.total_requirements);
    assert.equal(snapshot?.verification_progress.next_action, 'submit_for_review');

    await db.prepare(`
      UPDATE user_profiles
      SET verification_status = 'rejected', review_notes = ?
      WHERE user_id = ?
    `).run('Application rejected by administrator.', 'usr_test_public');

    snapshot = await getAccountSnapshot(db, 'usr_test_public');
    assert.equal(snapshot?.verification_progress.can_submit, false);
    assert.equal(canSubmitVerification(snapshot!).allowed, false);
    assert.match(canSubmitVerification(snapshot!).message || '', /cannot be submitted/i);

    const privileges = getPrivilegeSummary((await getAccountSnapshot(db, 'usr_test_gov'))!.user);
    assert.equal(privileges.accessGroup, 'Verified API Owner');
    assert.equal(privileges.permissions.includes('Review API access requests for APIs owned by your MDA'), true);
  });
}

main().then(() => {
  console.log('account verification tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
