import type { AccountProfile, AccountRequirement, AccountType, VerificationDocument } from './account-verification-types';

export const ENCRYPTED_PROFILE_FIELDS: Array<keyof AccountProfile> = [
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

export const ENCRYPTED_DOCUMENT_FIELDS: Array<keyof VerificationDocument> = [
  'file_name',
  'storage_ref',
];

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
