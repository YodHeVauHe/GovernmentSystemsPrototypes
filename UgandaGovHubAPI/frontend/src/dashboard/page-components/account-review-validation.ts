const allowedRoles = new Set(['admin', 'reviewer', 'api_owner', 'developer']);
const mdaIdPattern = /^[A-Za-z0-9_-]+$/;
const textControlPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const maxReviewTextLength = 2000;
const maxMdaIdLength = 200;

type AccountApprovalInput = {
  role: string;
  needsMda: boolean;
  mdaId: string | null | undefined;
};

type AccountApprovalValidation =
  | { ok: true; role: string; mdaId: string | null }
  | { ok: false; message: string };

export function validateAccountApprovalInput(input: AccountApprovalInput): AccountApprovalValidation {
  const role = input.role.trim();
  if (!allowedRoles.has(role)) {
    return { ok: false, message: 'Select a valid role before approving this account.' };
  }

  if (!input.needsMda) {
    return { ok: true, role, mdaId: null };
  }

  const mdaId = typeof input.mdaId === 'string' ? input.mdaId.trim() : '';
  if (!mdaId || mdaId.length > maxMdaIdLength || !mdaIdPattern.test(mdaId)) {
    return { ok: false, message: 'Select a valid MDA before approving this account.' };
  }

  return { ok: true, role, mdaId };
}

export function sanitizeReviewPromptText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > maxReviewTextLength || textControlPattern.test(trimmed)) return null;
  return trimmed;
}

export function isDeleteConfirmationMatch(value: string, userName: string) {
  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === 'delete' || normalizedValue === userName.trim().toLowerCase();
}
