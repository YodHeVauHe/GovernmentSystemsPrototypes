export class DashboardApiError extends Error {
  readonly path: string;
  readonly status: number;
  readonly code?: string;

  constructor(
    path: string,
    status: number,
    message: string,
    code?: string
  ) {
    super(message);
    this.name = 'DashboardApiError';
    this.path = path;
    this.status = status;
    this.code = code;
  }
}

export function getDashboardErrorCode(error: unknown) {
  return error instanceof DashboardApiError ? error.code : undefined;
}

export function isAdminMfaRequiredError(error: unknown) {
  return getDashboardErrorCode(error) === 'ADMIN_MFA_REQUIRED';
}

export function createDashboardApiError(
  path: string,
  status: number,
  body: { error?: string; code?: string }
) {
  return new DashboardApiError(
    path,
    status,
    body.error || `${path} failed with ${status}`,
    body.code
  );
}
