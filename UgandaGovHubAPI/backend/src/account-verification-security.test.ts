import assert from 'assert';
import { getAccountSnapshot, validateVerificationDocumentInput } from './account-verification';
import type { DbClient } from './db';

const testUser = {
  id: 'user-1',
  full_name: 'Jane Applicant',
  email: 'jane@example.test',
  password_hash: 'hash',
  account_type: 'private_company',
  requested_role: 'developer',
  requested_mda_id: null,
  requested_organization: 'Acme Ltd',
  requested_purpose: 'Integration testing',
  status: 'PENDING_REVIEW',
  role: null,
  mda_id: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-30T00:00:00.000Z',
  updated_at: '2026-05-30T00:00:00.000Z',
};

const testProfile = {
  user_id: testUser.id,
  verification_status: 'draft_profile',
  account_category: 'private_company',
  nin: 'CM123456789012',
  national_id_number: null,
  contact_phone: null,
  address: null,
  organization_name: 'Acme Ltd',
  organization_type: null,
  ursb_number: '80010001234567',
  brn: null,
  tin: '1000123456',
  staff_id: null,
  department: null,
  job_title: null,
  supervisor_name: null,
  supervisor_email: null,
  review_notes: null,
  submitted_at: null,
};

const testDocument = {
  id: 'doc-1',
  user_id: testUser.id,
  type: 'certificate_of_incorporation',
  label: 'Certificate of incorporation',
  file_name: 'incorporation.pdf',
  mime_type: 'application/pdf',
  storage_ref: 's3://govhub-vault/docs/private_company/incorporation.pdf',
  status: 'submitted',
  uploaded_at: '2026-05-30T00:00:00.000Z',
};

const db: DbClient = {
  async query<T extends Record<string, any> = any>(sql: string): Promise<{ rows: T[]; rowCount: number | null }> {
    let rows: Record<string, any>[] = [];
    if (sql.includes('SELECT * FROM users')) {
      rows = [testUser];
    } else if (sql.includes('SELECT * FROM user_profiles')) {
      rows = [testProfile];
    } else if (sql.includes('SELECT * FROM verification_documents')) {
      rows = [testDocument];
    }
    return { rows: rows as T[], rowCount: rows.length };
  },
};

async function runTest() {
  const documentInput = validateVerificationDocumentInput('private_company', {
    type: 'certificate_of_incorporation',
    label: 'Attacker supplied label',
    file_name: 'incorporation.pdf',
    mime_type: 'application/pdf',
    storage_ref: 's3://govhub-vault/docs/other-user/secret.pdf',
  });
  assert(documentInput.ok);
  assert.equal(
    Object.prototype.hasOwnProperty.call(documentInput.value, 'storage_ref'),
    false,
    'verification document validation must not accept client-supplied internal storage references',
  );

  const snapshot = await getAccountSnapshot(db, testUser.id);
  assert(snapshot);
  assert.equal(snapshot.documents.length, 1);
  assert.equal(snapshot.documents[0].file_name, testDocument.file_name);
  assert.equal(snapshot.documents[0].mime_type, testDocument.mime_type);
  assert.equal(
    Object.prototype.hasOwnProperty.call(snapshot.documents[0], 'storage_ref'),
    false,
    'account snapshot documents must not expose internal storage_ref values',
  );
}

void runTest().catch(error => {
  console.error(error);
  process.exit(1);
});
