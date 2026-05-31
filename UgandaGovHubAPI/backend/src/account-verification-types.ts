import type { PublicUser } from './auth';

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

export type PublicVerificationDocument = Omit<VerificationDocument, 'storage_ref'>;

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

export type VerificationProgress = {
  missing_fields: string[];
  missing_documents: string[];
  completed_fields: number;
  total_fields: number;
  completed_documents: number;
  total_documents: number;
  completed_requirements: number;
  total_requirements: number;
  can_submit: boolean;
  next_action:
    | 'complete_profile'
    | 'upload_documents'
    | 'submit_for_review'
    | 'await_admin_review'
    | 'respond_to_admin_request'
    | 'approved'
    | 'rejected'
    | 'suspended';
  message: string;
};

export type AccountSnapshot = {
  user: PublicUser;
  profile: AccountProfile;
  documents: PublicVerificationDocument[];
  requirements: AccountRequirement;
  privileges: PrivilegeSummary;
  verification_progress: VerificationProgress;
};
