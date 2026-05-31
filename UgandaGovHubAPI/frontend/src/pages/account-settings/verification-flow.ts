import type { AccountSettingsTabId, AccountSnapshot } from './types';

const profileFieldKeys = new Set([
  'account_category',
  'nin',
  'national_id_number',
  'contact_phone',
  'address',
]);

function missingLabels(account: AccountSnapshot) {
  const missingFields = account.verification_progress?.missing_fields || [];
  const missingDocuments = account.verification_progress?.missing_documents || [];
  return { missingFields, missingDocuments };
}

function requiredFieldLabels(account: AccountSnapshot, fieldKeys: Set<string>) {
  return new Set(
    account.requirements.requiredFields
      .filter(field => fieldKeys.has(field.key))
      .map(field => field.label)
  );
}

export function hasMissingProfileFields(account: AccountSnapshot) {
  const { missingFields } = missingLabels(account);
  if (missingFields.length === 0) return false;
  const profileLabels = requiredFieldLabels(account, profileFieldKeys);
  return missingFields.some(field => profileLabels.has(field));
}

export function hasMissingOrganizationFields(account: AccountSnapshot) {
  const { missingFields } = missingLabels(account);
  if (missingFields.length === 0) return false;
  const profileLabels = requiredFieldLabels(account, profileFieldKeys);
  return missingFields.some(field => !profileLabels.has(field));
}

export function hasMissingVerificationDocuments(account: AccountSnapshot) {
  return (account.verification_progress?.missing_documents || []).length > 0;
}

export function resolveNextVerificationTab(account: AccountSnapshot): AccountSettingsTabId {
  const status = account.profile.verification_status;
  if (status === 'submitted_for_review' || status === 'verified') return 'flow';
  if (hasMissingProfileFields(account)) return 'profile';
  if (hasMissingOrganizationFields(account)) return 'organization';
  if (hasMissingVerificationDocuments(account) || account.verification_progress?.can_submit) return 'documents';
  return 'profile';
}
