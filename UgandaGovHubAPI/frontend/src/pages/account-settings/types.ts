import type { AuthUser } from '@/context/UserContext';

export const accountSettingsTabIds = [
  'profile',
  'organization',
  'documents',
  'security',
  'privileges',
  'notifications',
  'flow',
] as const;

export type AccountSettingsTabId = (typeof accountSettingsTabIds)[number];

export type AccountVerificationStatus =
  | 'draft_profile'
  | 'needs_more_information'
  | 'submitted_for_review'
  | 'verified'
  | 'suspended'
  | 'rejected';

export type AccountProfileDraft = Record<string, string | null | undefined>;

export type AccountProfile = AccountProfileDraft & {
  verification_status: AccountVerificationStatus;
};

export type AccountDocument = {
  type: string;
  label: string;
  file_name: string;
  mime_type: string;
};

export type AccountRequirement = {
  label: string;
  description: string;
  requiredFields: Array<{ key: string; label: string }>;
  requiredDocuments: Array<{ type: string; label: string; accepts: string }>;
};

export type AccountPrivileges = {
  accessGroup: string;
  permissions: string[];
  restrictions: string[];
};

export type VerificationProgress = {
  missing_fields: string[];
  missing_documents: string[];
  completed_requirements: number;
  total_requirements: number;
  can_submit: boolean;
  next_action: string;
  message: string;
};

export type AccountSnapshot = {
  user: AuthUser;
  profile: AccountProfile;
  documents: AccountDocument[];
  requirements: AccountRequirement;
  privileges: AccountPrivileges;
  verification_progress?: VerificationProgress;
};

export type UpdateProfileDraft = (key: string, value: string) => void;

export function isAccountSettingsTabId(value: string | null | undefined): value is AccountSettingsTabId {
  return accountSettingsTabIds.includes(value as AccountSettingsTabId);
}

export function readAccountSettingsTabId(value: string | null | undefined): AccountSettingsTabId {
  return isAccountSettingsTabId(value) ? value : 'profile';
}
