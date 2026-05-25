import crypto from 'crypto';
import type Database from 'better-sqlite3';
import type { AuthUser, UserRole } from './auth';
import { decryptFields, encryptAtRest, encryptFields } from './crypto-at-rest';

export type AccountType =
  | 'government_employee'
  | 'mda_api_owner'
  | 'private_company'
  | 'business_name'
  | 'public_developer'
  | 'civil_society'
  | 'research_institution'
  | 'admin';

export type VerificationStatus =
  | 'draft_profile'
  | 'submitted_for_review'
  | 'needs_more_information'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type VerificationDocument = {
  id: string;
  user_id: string;
  type: string;
  label: string;
  file_name: string;
  mime_type: string;
  storage_ref: string;
  status: string;
  uploaded_at: string;
};

export type AccountProfile = {
  user_id: string;
  verification_status: VerificationStatus;
  account_category: AccountType;
  nin: string | null;
  national_id_number: string | null;
  contact_phone: string | null;
  address: string | null;
  organization_name: string | null;
  organization_type: string | null;
  ursb_number: string | null;
  brn: string | null;
  tin: string | null;
  staff_id: string | null;
  department: string | null;
  job_title: string | null;
  supervisor_name: string | null;
  supervisor_email: string | null;
  review_notes: string | null;
  submitted_at: string | null;
};

export type AccountSnapshot = {
  user: AuthUser;
  profile: AccountProfile;
  documents: VerificationDocument[];
  requirements: AccountRequirement;
  privileges: PrivilegeSummary;
};

export type AccountRequirement = {
  label: string;
  description: string;
  requiredFields: Array<{ key: keyof AccountProfile; label: string }>;
  requiredDocuments: Array<{ type: string; label: string; accepts: string }>;
};

export type PrivilegeSummary = {
  accessGroup: string;
  permissions: string[];
  restrictions: string[];
};

const ENCRYPTED_PROFILE_FIELDS: Array<keyof AccountProfile> = [
  'nin',
  'national_id_number',
  'contact_phone',
  'address',
  'organization_name',
  'organization_type',
  'ursb_number',
  'brn',
  'tin',
  'staff_id',
  'department',
  'job_title',
  'supervisor_name',
  'supervisor_email',
  'review_notes',
];

const ENCRYPTED_DOCUMENT_FIELDS: Array<keyof VerificationDocument> = [
  'file_name',
  'storage_ref',
];

export function encryptProfileForStorage(profile: Record<string, any>) {
  return encryptFields(profile, ENCRYPTED_PROFILE_FIELDS as string[]);
}

function decryptProfileFromStorage(profile: AccountProfile): AccountProfile {
  return decryptFields(profile, ENCRYPTED_PROFILE_FIELDS as string[]) as AccountProfile;
}

function decryptDocumentFromStorage(document: VerificationDocument): VerificationDocument {
  return decryptFields(document, ENCRYPTED_DOCUMENT_FIELDS as string[]) as VerificationDocument;
}

export const ACCOUNT_TYPE_REQUIREMENTS: Record<AccountType, AccountRequirement> = {
  government_employee: {
    label: 'Government Employee',
    description: 'For verified staff working under a Ugandan Ministry, Department, or Agency.',
    requiredFields: [
      { key: 'staff_id', label: 'Staff ID or appointment reference' },
      { key: 'department', label: 'Department or unit' },
      { key: 'job_title', label: 'Job title' },
      { key: 'supervisor_name', label: 'Supervisor name' },
      { key: 'supervisor_email', label: 'Supervisor email' },
    ],
    requiredDocuments: [
      { type: 'staff_id_or_appointment', label: 'Staff ID or appointment proof', accepts: 'image/*,application/pdf' },
      { type: 'authorization_letter', label: 'Authorization letter', accepts: 'image/*,application/pdf' },
    ],
  },
  mda_api_owner: {
    label: 'MDA API Owner',
    description: 'For MDA officers authorized to manage APIs owned by their institution.',
    requiredFields: [
      { key: 'staff_id', label: 'Staff ID or appointment reference' },
      { key: 'department', label: 'Department or unit' },
      { key: 'job_title', label: 'Job title' },
      { key: 'supervisor_name', label: 'Authorizing officer name' },
      { key: 'supervisor_email', label: 'Authorizing officer email' },
    ],
    requiredDocuments: [
      { type: 'mda_authorization_letter', label: 'MDA authorization letter', accepts: 'image/*,application/pdf' },
      { type: 'staff_id_or_appointment', label: 'Staff ID or appointment proof', accepts: 'image/*,application/pdf' },
    ],
  },
  private_company: {
    label: 'Private Company',
    description: 'For incorporated companies requesting API access for approved integrations.',
    requiredFields: [
      { key: 'organization_name', label: 'Company name' },
      { key: 'ursb_number', label: 'URSB registration number' },
      { key: 'tin', label: 'URA TIN' },
      { key: 'nin', label: 'Authorized representative NIN' },
    ],
    requiredDocuments: [
      { type: 'certificate_of_incorporation', label: 'Certificate of incorporation', accepts: 'image/*,application/pdf' },
      { type: 'ursb_registration', label: 'URSB registration document', accepts: 'image/*,application/pdf' },
      { type: 'ura_tin_certificate', label: 'URA TIN certificate', accepts: 'image/*,application/pdf' },
      { type: 'authorization_letter', label: 'Authorization letter', accepts: 'image/*,application/pdf' },
    ],
  },
  business_name: {
    label: 'Business Name',
    description: 'For registered businesses that are not incorporated companies.',
    requiredFields: [
      { key: 'organization_name', label: 'Business name' },
      { key: 'brn', label: 'Business Registration Number' },
      { key: 'nin', label: 'Proprietor or representative NIN' },
    ],
    requiredDocuments: [
      { type: 'business_registration_certificate', label: 'Business registration certificate', accepts: 'image/*,application/pdf' },
      { type: 'national_id_front', label: 'Representative national ID front', accepts: 'image/*' },
      { type: 'national_id_back', label: 'Representative national ID back', accepts: 'image/*' },
    ],
  },
  public_developer: {
    label: 'Public Developer',
    description: 'For individual developers requesting lawful API access after identity verification.',
    requiredFields: [
      { key: 'nin', label: 'National Identification Number' },
      { key: 'national_id_number', label: 'National ID number' },
      { key: 'contact_phone', label: 'Phone number' },
      { key: 'address', label: 'Address' },
    ],
    requiredDocuments: [
      { type: 'national_id_front', label: 'National ID front image', accepts: 'image/*' },
      { type: 'national_id_back', label: 'National ID back image', accepts: 'image/*' },
      { type: 'nin_confirmation', label: 'NIN confirmation or NIRA document', accepts: 'image/*,application/pdf' },
    ],
  },
  civil_society: {
    label: 'Civil Society',
    description: 'For registered non-government or civil society organizations.',
    requiredFields: [
      { key: 'organization_name', label: 'Organization name' },
      { key: 'tin', label: 'TIN if available' },
      { key: 'nin', label: 'Authorized representative NIN' },
    ],
    requiredDocuments: [
      { type: 'registration_certificate', label: 'Registration certificate', accepts: 'image/*,application/pdf' },
      { type: 'authorization_letter', label: 'Authorization letter', accepts: 'image/*,application/pdf' },
    ],
  },
  research_institution: {
    label: 'Research Institution',
    description: 'For universities and research institutions with approved public-interest use cases.',
    requiredFields: [
      { key: 'organization_name', label: 'Institution name' },
      { key: 'department', label: 'Research department' },
      { key: 'supervisor_name', label: 'Principal investigator or supervisor' },
      { key: 'supervisor_email', label: 'Institution contact email' },
    ],
    requiredDocuments: [
      { type: 'institution_authorization', label: 'Institution authorization letter', accepts: 'image/*,application/pdf' },
      { type: 'research_summary', label: 'Research or project summary', accepts: 'image/*,application/pdf' },
    ],
  },
  admin: {
    label: 'Platform Administrator',
    description: 'For trusted platform operators only.',
    requiredFields: [],
    requiredDocuments: [],
  },
};

export function normalizeAccountType(value: string | null | undefined): AccountType {
  if (value === 'government') return 'government_employee';
  if (value && value in ACCOUNT_TYPE_REQUIREMENTS) return value as AccountType;
  return 'public_developer';
}

export function ensureAccountVerificationSchema(db: Database.Database) {
  db.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, type),
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);

  const users = db.prepare('SELECT id, account_type, requested_organization FROM users').all() as Array<{ id: string; account_type: string; requested_organization: string }>;
  const insertProfile = db.prepare(`
    INSERT OR IGNORE INTO user_profiles (user_id, account_category, organization_name)
    VALUES (?, ?, ?)
  `);
  for (const user of users) {
    insertProfile.run(user.id, normalizeAccountType(user.account_type), encryptAtRest(user.requested_organization || null));
  }
  encryptExistingAccountVerificationData(db);
}

export function ensureUserProfile(db: Database.Database, userId: string, accountType?: string, organizationName?: string) {
  db.prepare(`
    INSERT OR IGNORE INTO user_profiles (user_id, account_category, organization_name)
    VALUES (?, ?, ?)
  `).run(userId, normalizeAccountType(accountType), encryptAtRest(organizationName || null));
}

function encryptExistingAccountVerificationData(db: Database.Database) {
  const profileRows = db.prepare('SELECT * FROM user_profiles').all() as AccountProfile[];
  const updateProfile = db.prepare(`
    UPDATE user_profiles SET
      nin = ?, national_id_number = ?, contact_phone = ?, address = ?,
      organization_name = ?, organization_type = ?, ursb_number = ?, brn = ?, tin = ?,
      staff_id = ?, department = ?, job_title = ?, supervisor_name = ?, supervisor_email = ?,
      review_notes = ?
    WHERE user_id = ?
  `);
  for (const profile of profileRows) {
    const encrypted = encryptProfileForStorage(profile);
    updateProfile.run(
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
    );
  }

  const documentRows = db.prepare('SELECT * FROM verification_documents').all() as VerificationDocument[];
  const updateDocument = db.prepare('UPDATE verification_documents SET file_name = ?, storage_ref = ? WHERE id = ?');
  for (const document of documentRows) {
    const encrypted = encryptFields(document, ENCRYPTED_DOCUMENT_FIELDS as string[]);
    updateDocument.run(encrypted.file_name, encrypted.storage_ref, document.id);
  }
}

export function upsertVerificationDocument(db: Database.Database, userId: string, input: Omit<Partial<VerificationDocument>, 'id' | 'user_id' | 'uploaded_at'> & { type: string; label: string; file_name: string; mime_type: string; storage_ref?: string }) {
  const id = `doc_${crypto.randomUUID()}`;
  const encryptedFileName = encryptAtRest(input.file_name);
  const encryptedStorageRef = encryptAtRest(input.storage_ref || `metadata://${userId}/${input.file_name}`);
  db.prepare(`
    INSERT INTO verification_documents (id, user_id, type, label, file_name, mime_type, storage_ref, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted')
    ON CONFLICT(user_id, type) DO UPDATE SET
      label = excluded.label,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      storage_ref = excluded.storage_ref,
      status = 'submitted',
      uploaded_at = CURRENT_TIMESTAMP
  `).run(id, userId, input.type, input.label, encryptedFileName, input.mime_type, encryptedStorageRef);
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

export function getAccountSnapshot(db: Database.Database, userId: string): AccountSnapshot | null {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as AuthUser | undefined;
  if (!user) return null;
  ensureUserProfile(db, user.id, user.account_type, user.requested_organization);
  const profile = decryptProfileFromStorage(db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as AccountProfile);
  const documents = (db.prepare('SELECT * FROM verification_documents WHERE user_id = ? ORDER BY uploaded_at DESC').all(userId) as VerificationDocument[])
    .map(decryptDocumentFromStorage);
  const accountType = normalizeAccountType(profile.account_category || user.account_type);
  return {
    user,
    profile,
    documents,
    requirements: ACCOUNT_TYPE_REQUIREMENTS[accountType],
    privileges: getPrivilegeSummary(user),
  };
}

export function canSubmitVerification(snapshot: AccountSnapshot): { allowed: boolean; message?: string } {
  const missingFields = snapshot.requirements.requiredFields
    .filter(field => !snapshot.profile[field.key])
    .map(field => field.label);
  const submittedTypes = new Set(snapshot.documents.map(document => document.type));
  const missingDocuments = snapshot.requirements.requiredDocuments
    .filter(document => !submittedTypes.has(document.type))
    .map(document => document.type);

  if (missingFields.length || missingDocuments.length) {
    return {
      allowed: false,
      message: `Missing required verification data: ${[...missingFields, ...missingDocuments].join(', ')}`,
    };
  }
  return { allowed: true };
}
