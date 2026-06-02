import { formatHttpStatusLabel } from '../lib/http-status';

export type ViewMode = 'list' | 'grid';

export type DashboardViewTab = 'approvals' | 'accounts' | 'credentials' | 'apiLogs' | 'audit' | 'matrix' | 'analytics';

export type ViewModePreferenceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const DASHBOARD_VIEW_MODE_STORAGE_KEY = 'govhub.dashboard.viewModes';

export type AuditEventTone = 'denied' | 'allowed' | 'neutral';

export type MatrixTarget = {
  apiId: string;
  label: string;
};

export const MATRIX_TARGETS: MatrixTarget[] = [
  { apiId: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6', label: 'NIRA Identity' },
  { apiId: 'api-ura-13897843-012d-4951-8b06-374fff183c3e', label: 'URA Tax Clearance' },
  { apiId: 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65', label: 'URSB Registry' },
  { apiId: 'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7', label: 'MoWT Transport' },
  { apiId: 'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac', label: 'MoICT Composite' },
];

function isViewMode(value: unknown): value is ViewMode {
  return value === 'list' || value === 'grid';
}

function readDashboardViewModePreferences(storage: ViewModePreferenceStorage) {
  try {
    const rawPreferences = storage.getItem(DASHBOARD_VIEW_MODE_STORAGE_KEY);
    if (!rawPreferences) return {};

    const parsedPreferences = JSON.parse(rawPreferences);
    if (!parsedPreferences || typeof parsedPreferences !== 'object' || Array.isArray(parsedPreferences)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedPreferences).filter(([, value]) => isViewMode(value))
    ) as Partial<Record<DashboardViewTab, ViewMode>>;
  } catch {
    return {};
  }
}

export function readDashboardViewModePreference(
  storage: ViewModePreferenceStorage,
  tab: DashboardViewTab,
  fallback: ViewMode = 'list'
) {
  return readDashboardViewModePreferences(storage)[tab] || fallback;
}

export function writeDashboardViewModePreference(
  storage: ViewModePreferenceStorage,
  tab: DashboardViewTab,
  viewMode: ViewMode
) {
  try {
    storage.setItem(DASHBOARD_VIEW_MODE_STORAGE_KEY, JSON.stringify({
      ...readDashboardViewModePreferences(storage),
      [tab]: viewMode,
    }));
  } catch {
    // Storage is a preference cache only; private mode or quota failures should not break the dashboard.
  }
}

export function getAuditEventTone(eventType: string): AuditEventTone {
  if (eventType.includes('DENIED')) return 'denied';
  if (eventType.includes('ALLOWED')) return 'allowed';
  return 'neutral';
}

export function formatAuditLogDetails(details: unknown) {
  if (details === null || details === undefined || details === '') {
    return '{}';
  }

  if (typeof details === 'string') {
    try {
      return JSON.stringify(JSON.parse(details), null, 2);
    } catch {
      return details;
    }
  }

  try {
    return JSON.stringify(details, null, 2) || '{}';
  } catch {
    return String(details);
  }
}

export function parseAuditLogDetails(details: unknown): Record<string, unknown> {
  if (!details || typeof details !== 'string') {
    return details && typeof details === 'object' && !Array.isArray(details) ? details as Record<string, unknown> : {};
  }

  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getAuditLogEndpoint(log: { details?: unknown }) {
  const details = parseAuditLogDetails(log.details);
  const path = typeof details.path === 'string' ? details.path : '';
  const method = typeof details.method === 'string' ? details.method.toUpperCase() : '';
  if (!path) return '';
  return method ? `${method} ${path}` : path;
}

export function getAuditLogResponseStatus(log: { details?: unknown }) {
  const details = parseAuditLogDetails(log.details);
  const value = details.response_status ?? details.response_code;
  const status = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(status) ? status : null;
}

export function getAuditLogResponseStatusLabel(log: { details?: unknown }) {
  const status = getAuditLogResponseStatus(log);
  return status === null ? '' : formatHttpStatusLabel(status);
}

export function getRequestStatusLabel(request: { status?: string; api_key_status?: string | null; api_key_revoked_at?: string | null }) {
  if (request.status === 'APPROVED' && request.api_key_revoked_at) return 'REVOKED';
  return request.status === 'APPROVED'
    ? request.api_key_status || 'ACTIVE'
    : request.status || 'PENDING';
}

export function hasActiveApprovedApiKey(request: {
  status?: string;
  api_key_preview?: string | null;
  api_key?: string | null;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
}) {
  return (
    request.status === 'APPROVED' &&
    Boolean(request.api_key_preview) &&
    (request.api_key_status || 'ACTIVE') === 'ACTIVE' &&
    !request.api_key_revoked_at &&
    (!request.api_key_expires_at || new Date(request.api_key_expires_at).getTime() > Date.now())
  );
}

export function hasPendingOneTimeApiKeyReveal(request: {
  status?: string;
  api_key_preview?: string | null;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
  api_key_pending_reveal?: boolean | number | null;
}) {
  return hasActiveApprovedApiKey(request) && Boolean(request.api_key_pending_reveal);
}

export function canCopyOneTimeApiKey(apiKey: string | null | undefined, hasCopied: boolean) {
  return Boolean(apiKey) && !hasCopied;
}

export function canViewAuditLogsTab(role: string, requests: Array<{
  status?: string;
  api_key_preview?: string | null;
  api_key_status?: string | null;
  api_key_expires_at?: string | null;
  api_key_revoked_at?: string | null;
}>) {
  return role === 'admin' || role === 'reviewer' || (role === 'developer' && requests.some(hasActiveApprovedApiKey));
}

export function getVisibleDashboardTabs(role: string, canViewAuditLogs: boolean): DashboardViewTab[] {
  return [
    ...(role !== 'developer' && role !== 'reviewer' ? ['approvals' as const] : []),
    ...(role === 'admin' ? ['accounts' as const] : []),
    ...(role === 'developer' ? ['credentials' as const] : []),
    ...(role === 'admin' ? ['apiLogs' as const] : []),
    ...(canViewAuditLogs ? [
      'audit' as const,
      ...(role === 'reviewer' || role === 'admin' ? ['matrix' as const] : []),
    ] : []),
    ...(role === 'developer' || role === 'reviewer' || role === 'admin' ? ['analytics' as const] : []),
  ];
}

function isSandboxCallLog(log: { event_type?: string }) {
  return String(log.event_type || '').startsWith('SANDBOX_CALL');
}

export function filterPersonalApiCallLogs(
  logs: any[],
  options: { userId?: string | null; mdaId?: string | null; search: string }
) {
  const scopedLogs = logs.filter(log => (
    isSandboxCallLog(log) &&
    (
      log.consumer_user_id === options.userId ||
      Boolean(options.mdaId && !log.consumer_user_id && log.mda_id === options.mdaId)
    )
  ));

  return filterDashboardAuditLogs(scopedLogs, {
    role: 'admin',
    filterMda: 'ALL',
    search: options.search,
  });
}

export function filterDashboardAuditLogs(
  logs: any[],
  options: { role: string; filterMda: string; search: string }
) {
  const normalizedSearch = options.search.trim().toLowerCase();

  return logs.filter(log => {
    if (options.role === 'developer' && !isSandboxCallLog(log)) return false;
    if (options.role !== 'developer' && options.filterMda !== 'ALL' && log.mda_id !== options.filterMda) return false;
    return true;
  }).filter(log => {
    if (!normalizedSearch) return true;
    return [
      log.event_type,
      log.mda_name,
      log.api_name,
      getAuditLogEndpoint(log),
      log.request_id,
      log.correlation_id,
      log.details,
    ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));
  });
}

export function isMatrixChannelActive(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  apiId: string
) {
  return matrix.some(row => row.consumer_mda_id === consumerMdaId && row.api_id === apiId);
}

export function buildMatrixChannelRows(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  targets = MATRIX_TARGETS
) {
  return targets.map(target => ({
    ...target,
    active: isMatrixChannelActive(matrix, consumerMdaId, target.apiId),
  }));
}
