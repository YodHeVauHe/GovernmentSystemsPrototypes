import crypto from 'crypto';
import { sanitizeUser, type AuthUser } from './auth';
import {
  ACCOUNT_TYPE_REQUIREMENTS,
  ENCRYPTED_DOCUMENT_FIELDS,
  ENCRYPTED_PROFILE_FIELDS,
  normalizeAccountType,
} from './account-verification-policy';
import type {
  AccountProfile,
  AccountRequirement,
  AccountSnapshot,
  AccountType,
  PrivilegeSummary,
  PublicVerificationDocument,
  VerificationDocument,
  VerificationProgress,
  VerificationStatus,
} from './account-verification-types';
import { decryptFields, encryptAtRest, encryptFields } from './crypto-at-rest';
import type { DbClient } from './db';
import { exec, many, one, run } from './db';

export type {
  AccountProfile,
  AccountRequirement,
  AccountSnapshot,
  AccountType,
  PrivilegeSummary,
  PublicVerificationDocument,
  VerificationDocument,
  VerificationProgress,
  VerificationStatus,
} from './account-verification-types';
export { ACCOUNT_TYPE_REQUIREMENTS, normalizeAccountType } from './account-verification-policy';
export { isRoleAllowedForAccountType } from './account-verification-policy';

export function encryptProfileForStorage(profile: Record<string, any>) {
  return encryptFields(profile, ENCRYPTED_PROFILE_FIELDS as string[]);
}

function decryptProfileFromStorage(profile: AccountProfile): AccountProfile {
  return decryptFields(profile, ENCRYPTED_PROFILE_FIELDS as string[]) as AccountProfile;
}

function decryptDocumentFromStorage(document: VerificationDocument): VerificationDocument {
  return decryptFields(document, ENCRYPTED_DOCUMENT_FIELDS as string[]) as VerificationDocument;
}

export function sanitizeVerificationDocumentForSnapshot(document: VerificationDocument): PublicVerificationDocument {
  const { storage_ref, ...publicDocument } = document;
  return publicDocument;
}

type VerificationDocumentUploadInput = {
  type?: unknown;
  label?: unknown;
  file_name?: unknown;
  mime_type?: unknown;
  storage_ref?: unknown;
};

type ValidVerificationDocumentInput = {
  type: string;
  label: string;
  file_name: string;
  mime_type: string;
};

type VerificationDocumentInputValidation =
  | { ok: true; value: ValidVerificationDocumentInput }
  | { ok: false; code: string; message: string };

const DOCUMENT_FILE_NAME_MAX_LENGTH = 255;
const MIME_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

function trimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasControlCharacters(value: string) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function acceptsMimeType(accepts: string, mimeType: string) {
  return accepts
    .split(',')
    .map(value => value.trim().toLowerCase())
    .some(accept => {
      if (!accept) return false;
      if (accept.endsWith('/*')) {
        return mimeType.startsWith(`${accept.slice(0, -1)}`);
      }
      return accept === mimeType;
    });
}

function isSafeDocumentFileName(fileName: string) {
  if (!fileName || fileName.length > DOCUMENT_FILE_NAME_MAX_LENGTH) return false;
  if (hasControlCharacters(fileName)) return false;
  if (fileName === '.' || fileName === '..') return false;
  return !/[\\/]/.test(fileName);
}

export function validateVerificationDocumentInput(
  accountType: AccountType,
  input: VerificationDocumentUploadInput,
): VerificationDocumentInputValidation {
  const requirements = ACCOUNT_TYPE_REQUIREMENTS[normalizeAccountType(accountType)];
  const type = trimmedString(input.type);
  const fileName = trimmedString(input.file_name);
  const mimeType = trimmedString(input.mime_type).toLowerCase();
  const documentRequirement = requirements.requiredDocuments.find(document => document.type === type);

  if (!documentRequirement) {
    return {
      ok: false,
      code: 'INVALID_DOCUMENT_TYPE',
      message: 'Document type is not required for this account category.',
    };
  }
  if (!isSafeDocumentFileName(fileName)) {
    return {
      ok: false,
      code: 'INVALID_DOCUMENT_FILE_NAME',
      message: 'Document file_name must be a plain file name with no path separators and 255 characters or fewer.',
    };
  }
  if (!MIME_TYPE_RE.test(mimeType) || !acceptsMimeType(documentRequirement.accepts, mimeType)) {
    return {
      ok: false,
      code: 'INVALID_DOCUMENT_MIME',
      message: `Document mime_type must match ${documentRequirement.accepts}.`,
    };
  }

  return {
    ok: true,
    value: {
      type,
      label: documentRequirement.label,
      file_name: fileName,
      mime_type: mimeType,
    },
  };
}

function initialAccountCategory(user: { account_type: string; requested_role?: string | null; role?: string | null; status?: string | null }): AccountType {
  if (user.status === 'APPROVED' && (user.role === 'admin' || user.requested_role === 'admin')) {
    return 'admin';
  }
  return normalizeAccountType(user.account_type);
}

function initialVerificationStatus(user: { status?: string | null; role?: string | null }): VerificationStatus {
  if (user.status === 'APPROVED' && user.role) return 'verified';
  if (user.status === 'REJECTED') return 'rejected';
  if (user.status === 'SUSPENDED') return 'suspended';
  return 'draft_profile';
}

async function reconcileUserProfileWithAuthState(db: DbClient, user: { id: string; status?: string | null; role?: string | null }) {
  if (user.status !== 'APPROVED' || !user.role) return;
  await run(db, `
    UPDATE user_profiles
    SET verification_status = 'verified',
        review_notes = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND verification_status = 'draft_profile'
  `, [user.id]);
  if (user.role === 'admin') {
    await run(db, `
      UPDATE user_profiles
      SET account_category = 'admin',
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
        AND account_category <> 'admin'
    `, [user.id]);
  }
}

export async function ensureAccountVerificationSchema(db: DbClient) {
  await exec(db, `
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      verification_status TEXT NOT NULL DEFAULT 'draft_profile',
      account_category TEXT NOT NULL DEFAULT 'public_developer',
      nin TEXT,
      national_id_number TEXT,
      contact_phone TEXT,
      address TEXT,
      organization_name TEXT,
      organization_type TEXT,
      ursb_number TEXT,
      brn TEXT,
      tin TEXT,
      staff_id TEXT,
      department TEXT,
      job_title TEXT,
      supervisor_name TEXT,
      supervisor_email TEXT,
      review_notes TEXT,
      submitted_at TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS verification_documents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      storage_ref TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, type),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  const users = await many<{
    id: string;
    account_type: string;
    requested_role: string | null;
    role: string | null;
    status: string;
    requested_organization: string;
  }>(db, 'SELECT id, account_type, requested_role, role, status, requested_organization FROM users');
  for (const user of users) {
    await run(db, `
      INSERT INTO user_profiles (user_id, verification_status, account_category, organization_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO NOTHING
    `, [
      user.id,
      initialVerificationStatus(user),
      initialAccountCategory(user),
      encryptAtRest(user.requested_organization || null)
    ]);
    await reconcileUserProfileWithAuthState(db, user);
  }
  await encryptExistingAccountVerificationData(db);
}

export async function ensureUserProfile(db: DbClient, userId: string, accountType?: string, organizationName?: string) {
  await run(db, `
    INSERT INTO user_profiles (user_id, account_category, organization_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO NOTHING
  `, [userId, normalizeAccountType(accountType), encryptAtRest(organizationName || null)]);
}

async function encryptExistingAccountVerificationData(db: DbClient) {
  const profileRows = await many<AccountProfile>(db, 'SELECT * FROM user_profiles');
  const updateProfile = `
    UPDATE user_profiles SET
      nin = $1, national_id_number = $2, contact_phone = $3, address = $4,
      organization_name = $5, organization_type = $6, ursb_number = $7, brn = $8, tin = $9,
      staff_id = $10, department = $11, job_title = $12, supervisor_name = $13, supervisor_email = $14,
      review_notes = $15
    WHERE user_id = $16
  `;
  for (const profile of profileRows) {
    const encrypted = encryptProfileForStorage(profile);
    await run(db, updateProfile, [
      encrypted.nin,
      encrypted.national_id_number,
      encrypted.contact_phone,
      encrypted.address,
      encrypted.organization_name,
      encrypted.organization_type,
      encrypted.ursb_number,
      encrypted.brn,
      encrypted.tin,
      encrypted.staff_id,
      encrypted.department,
      encrypted.job_title,
      encrypted.supervisor_name,
      encrypted.supervisor_email,
      encrypted.review_notes,
      profile.user_id
    ]);
  }

  const documentRows = await many<VerificationDocument>(db, 'SELECT * FROM verification_documents');
  for (const document of documentRows) {
    const encrypted = encryptFields(document, ENCRYPTED_DOCUMENT_FIELDS as string[]);
    await run(db, 'UPDATE verification_documents SET file_name = $1, storage_ref = $2 WHERE id = $3', [encrypted.file_name, encrypted.storage_ref, document.id]);
  }
}

export async function upsertVerificationDocument(db: DbClient, userId: string, input: Omit<Partial<VerificationDocument>, 'id' | 'user_id' | 'uploaded_at'> & { type: string; label: string; file_name: string; mime_type: string; storage_ref?: string }) {
  const id = `doc_${crypto.randomUUID()}`;
  const encryptedFileName = encryptAtRest(input.file_name);
  const encryptedStorageRef = encryptAtRest(input.storage_ref || `metadata://${userId}/${input.file_name}`);
  await run(db, `
    INSERT INTO verification_documents (id, user_id, type, label, file_name, mime_type, storage_ref, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'submitted')
    ON CONFLICT(user_id, type) DO UPDATE SET
      label = excluded.label,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      storage_ref = excluded.storage_ref,
      status = 'submitted',
      uploaded_at = CURRENT_TIMESTAMP
  `, [id, userId, input.type, input.label, encryptedFileName, input.mime_type, encryptedStorageRef]);
}

export function getPrivilegeSummary(user: Pick<AuthUser, 'status' | 'role'>): PrivilegeSummary {
  if (user.status !== 'APPROVED') {
    return {
      accessGroup: 'Registered Applicant',
      permissions: ['Complete profile', 'Submit verification documents', 'View review status'],
      restrictions: ['Cannot request API keys', 'Cannot access dashboard workflows', 'Cannot approve access'],
    };
  }

  const role = user.role;
  if (role === 'admin') {
    return {
      accessGroup: 'Platform Administrator',
      permissions: ['Approve accounts', 'Manage API catalog', 'Approve or revoke API keys', 'View audit logs'],
      restrictions: ['Admin actions are audit logged'],
    };
  }
  if (role === 'api_owner') {
    return {
      accessGroup: 'Verified API Owner',
      permissions: ['Review API access requests for APIs owned by your MDA', 'Manage owned API metadata', 'View relevant access requests'],
      restrictions: ['Cannot approve user accounts', 'Cannot manage unrelated MDAs'],
    };
  }
  if (role === 'reviewer') {
    return {
      accessGroup: 'Compliance Reviewer',
      permissions: ['View audit trails', 'Inspect compliance metadata', 'Review access matrix'],
      restrictions: ['Read-focused role by default', 'Cannot approve API keys'],
    };
  }
  return {
    accessGroup: 'Verified Developer',
    permissions: ['Request API access', 'View own API keys', 'Use approved sandbox endpoints'],
    restrictions: ['Cannot approve own requests', 'Cannot view other organizations secrets'],
  };
}

export function getVerificationProgress(
  profile: AccountProfile,
  documents: Array<Pick<VerificationDocument, 'status' | 'type'>>,
  requirements: AccountRequirement
): VerificationProgress {
  const missingFields = requirements.requiredFields
    .filter(field => !profile[field.key])
    .map(field => field.label);
  const submittedTypes = new Set(documents
    .filter(document => document.status === 'submitted')
    .map(document => document.type));
  const missingDocuments = requirements.requiredDocuments
    .filter(document => !submittedTypes.has(document.type))
    .map(document => document.type);
  const completedFields = requirements.requiredFields.length - missingFields.length;
  const completedDocuments = requirements.requiredDocuments.length - missingDocuments.length;
  const totalRequirements = requirements.requiredFields.length + requirements.requiredDocuments.length;
  const completedRequirements = completedFields + completedDocuments;
  const hasAllRequirements = missingFields.length === 0 && missingDocuments.length === 0;

  if (profile.verification_status === 'verified') {
    return {
      missing_fields: [],
      missing_documents: [],
      completed_fields: requirements.requiredFields.length,
      total_fields: requirements.requiredFields.length,
      completed_documents: requirements.requiredDocuments.length,
      total_documents: requirements.requiredDocuments.length,
      completed_requirements: totalRequirements,
      total_requirements: totalRequirements,
      can_submit: false,
      next_action: 'approved',
      message: 'Your identity and organization verification is complete.',
    };
  }

  if (profile.verification_status === 'submitted_for_review') {
    return {
      missing_fields: missingFields,
      missing_documents: missingDocuments,
      completed_fields: completedFields,
      total_fields: requirements.requiredFields.length,
      completed_documents: completedDocuments,
      total_documents: requirements.requiredDocuments.length,
      completed_requirements: completedRequirements,
      total_requirements: totalRequirements,
      can_submit: false,
      next_action: 'await_admin_review',
      message: 'Your verification package has been submitted and is waiting for administrator review.',
    };
  }

  if (profile.verification_status === 'needs_more_information') {
    return {
      missing_fields: missingFields,
      missing_documents: missingDocuments,
      completed_fields: completedFields,
      total_fields: requirements.requiredFields.length,
      completed_documents: completedDocuments,
      total_documents: requirements.requiredDocuments.length,
      completed_requirements: completedRequirements,
      total_requirements: totalRequirements,
      can_submit: hasAllRequirements,
      next_action: hasAllRequirements ? 'submit_for_review' : 'respond_to_admin_request',
      message: profile.review_notes || 'An administrator requested more verification information before approval.',
    };
  }

  if (profile.verification_status === 'rejected') {
    return {
      missing_fields: missingFields,
      missing_documents: missingDocuments,
      completed_fields: completedFields,
      total_fields: requirements.requiredFields.length,
      completed_documents: completedDocuments,
      total_documents: requirements.requiredDocuments.length,
      completed_requirements: completedRequirements,
      total_requirements: totalRequirements,
      can_submit: false,
      next_action: 'rejected',
      message: profile.review_notes || 'This verification request was rejected by an administrator.',
    };
  }

  if (profile.verification_status === 'suspended') {
    return {
      missing_fields: missingFields,
      missing_documents: missingDocuments,
      completed_fields: completedFields,
      total_fields: requirements.requiredFields.length,
      completed_documents: completedDocuments,
      total_documents: requirements.requiredDocuments.length,
      completed_requirements: completedRequirements,
      total_requirements: totalRequirements,
      can_submit: false,
      next_action: 'suspended',
      message: 'This account is suspended and cannot complete verification.',
    };
  }

  return {
    missing_fields: missingFields,
    missing_documents: missingDocuments,
    completed_fields: completedFields,
    total_fields: requirements.requiredFields.length,
    completed_documents: completedDocuments,
    total_documents: requirements.requiredDocuments.length,
    completed_requirements: completedRequirements,
    total_requirements: totalRequirements,
    can_submit: hasAllRequirements,
    next_action: missingFields.length ? 'complete_profile' : missingDocuments.length ? 'upload_documents' : 'submit_for_review',
    message: hasAllRequirements
      ? 'Your verification package is ready to submit for administrator review.'
      : 'Complete verification before an administrator can approve dashboard and API access.',
  };
}

export async function getAccountSnapshot(db: DbClient, userId: string): Promise<AccountSnapshot | null> {
  const user = await one<AuthUser>(db, 'SELECT * FROM users WHERE id = $1', [userId]);
  if (!user) return null;
  await ensureUserProfile(db, user.id, user.account_type, user.requested_organization);
  await reconcileUserProfileWithAuthState(db, user);
  const profile = decryptProfileFromStorage(await one<AccountProfile>(db, 'SELECT * FROM user_profiles WHERE user_id = $1', [userId]) as AccountProfile);
  const documents = (await many<VerificationDocument>(db, 'SELECT * FROM verification_documents WHERE user_id = $1 ORDER BY uploaded_at DESC', [userId]))
    .map(decryptDocumentFromStorage);
  const publicDocuments = documents.map(sanitizeVerificationDocumentForSnapshot);
  const accountType = normalizeAccountType(profile.account_category || user.account_type);
  const requirements = ACCOUNT_TYPE_REQUIREMENTS[accountType];
  return {
    user: sanitizeUser(user),
    profile,
    documents: publicDocuments,
    requirements,
    privileges: getPrivilegeSummary(user),
    verification_progress: getVerificationProgress(profile, documents, requirements),
  };
}

export function canSubmitVerification(snapshot: AccountSnapshot): { allowed: boolean; message?: string; code?: string } {
  const missingFields = snapshot.verification_progress.missing_fields;
  const missingDocuments = snapshot.verification_progress.missing_documents;

  if (missingFields.length || missingDocuments.length) {
    return {
      allowed: false,
      message: `Missing required verification data: ${[...missingFields, ...missingDocuments].join(', ')}`,
    };
  }
  if (!snapshot.verification_progress.can_submit) {
    return {
      allowed: false,
      code: 'VERIFICATION_NOT_SUBMITTABLE',
      message: 'This verification package cannot be submitted in its current status.',
    };
  }
  return { allowed: true };
}
