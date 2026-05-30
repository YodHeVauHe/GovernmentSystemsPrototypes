type SandboxStringValidation =
  | { ok: true; value: string }
  | { ok: false; code: string; message: string };

type OptionalSandboxStringValidation =
  | { ok: true; value: string | null }
  | { ok: false; code: string; message: string };

function invalidCodeForField(fieldName: string) {
  return `INVALID_${fieldName.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

export function requiredSandboxString(
  value: unknown,
  fieldName: string,
  missingCode: string,
  missingMessage: string,
  invalidCode = invalidCodeForField(fieldName),
): SandboxStringValidation {
  if (value === undefined || value === null || value === '') {
    return { ok: false, code: missingCode, message: missingMessage };
  }
  if (typeof value !== 'string') {
    return { ok: false, code: invalidCode, message: `The "${fieldName}" field must be a string.` };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, code: missingCode, message: missingMessage };
  }
  return { ok: true, value: trimmed };
}

export function optionalSandboxString(
  value: unknown,
  fieldName: string,
  invalidCode = invalidCodeForField(fieldName),
): OptionalSandboxStringValidation {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, code: invalidCode, message: `The "${fieldName}" field must be a string.` };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed || null };
}
