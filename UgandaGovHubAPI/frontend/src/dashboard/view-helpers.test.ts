import assert from 'assert/strict';
import {
  DASHBOARD_VIEW_MODE_STORAGE_KEY,
  MATRIX_TARGETS,
  buildMatrixChannelRows,
  canViewAuditLogsTab,
  canCopyOneTimeApiKey,
  filterDashboardAuditLogs,
  getAuditEventTone,
  getRequestStatusLabel,
  hasActiveApprovedApiKey,
  hasPendingOneTimeApiKeyReveal,
  isMatrixChannelActive,
  formatAuditLogDetails,
  readDashboardViewModePreference,
  writeDashboardViewModePreference,
} from './view-helpers.ts';

const matrix = [
  { consumer_mda_id: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6' },
  { consumer_mda_id: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', api_id: 'api-ura-13897843-012d-4951-8b06-374fff183c3e' },
  { consumer_mda_id: 'mda-ura-2efff0d3-952e-4475-8231-232873a69854', api_id: 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65' },
];

function createStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key) || null : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

const dashboardViewStorage = createStorage();

assert.equal(readDashboardViewModePreference(dashboardViewStorage, 'approvals'), 'list');
writeDashboardViewModePreference(dashboardViewStorage, 'approvals', 'grid');
writeDashboardViewModePreference(dashboardViewStorage, 'audit', 'list');

assert.equal(readDashboardViewModePreference(dashboardViewStorage, 'approvals'), 'grid');
assert.equal(readDashboardViewModePreference(dashboardViewStorage, 'audit'), 'list');
assert.equal(readDashboardViewModePreference(dashboardViewStorage, 'credentials'), 'list');

const malformedViewStorage = createStorage({
  [DASHBOARD_VIEW_MODE_STORAGE_KEY]: JSON.stringify({ approvals: 'cards', audit: 'grid' }),
});

assert.equal(readDashboardViewModePreference(malformedViewStorage, 'approvals'), 'list');
assert.equal(readDashboardViewModePreference(malformedViewStorage, 'audit'), 'grid');

assert.equal(getAuditEventTone('SANDBOX_CALL_DENIED'), 'denied');
assert.equal(getAuditEventTone('SANDBOX_CALL_ALLOWED'), 'allowed');
assert.equal(getAuditEventTone('ACCESS_APPROVED'), 'neutral');

assert.equal(formatAuditLogDetails('{"path":"/api/v1/status","status":200}'), '{\n  "path": "/api/v1/status",\n  "status": 200\n}');
assert.equal(formatAuditLogDetails('{not-json'), '{not-json');
assert.equal(formatAuditLogDetails(null), '{}');
assert.equal(formatAuditLogDetails({ method: 'GET', status: 403 }), '{\n  "method": "GET",\n  "status": 403\n}');

assert.equal(getRequestStatusLabel({ status: 'PENDING' }), 'PENDING');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'ACTIVE' }), 'ACTIVE');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'REVOKED' }), 'REVOKED');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'ACTIVE', api_key_revoked_at: '2026-05-22T10:00:00.000Z' }), 'REVOKED');

assert.equal(hasActiveApprovedApiKey({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE' }), true);
assert.equal(hasActiveApprovedApiKey({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'REVOKED' }), false);
assert.equal(hasActiveApprovedApiKey({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE', api_key_revoked_at: '2026-05-22T10:00:00.000Z' }), false);
assert.equal(hasActiveApprovedApiKey({ status: 'PENDING', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE' }), false);

assert.equal(hasPendingOneTimeApiKeyReveal({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE', api_key_pending_reveal: true }), true);
assert.equal(hasPendingOneTimeApiKeyReveal({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE', api_key_pending_reveal: 1 }), true);
assert.equal(hasPendingOneTimeApiKeyReveal({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE', api_key_pending_reveal: false }), false);
assert.equal(hasPendingOneTimeApiKeyReveal({ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'REVOKED', api_key_pending_reveal: true }), false);

assert.equal(canCopyOneTimeApiKey('ghk_full_key', false), true);
assert.equal(canCopyOneTimeApiKey('ghk_full_key', true), false);
assert.equal(canCopyOneTimeApiKey('', false), false);

assert.equal(canViewAuditLogsTab('developer', [{ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE' }]), true);
assert.equal(canViewAuditLogsTab('developer', [{ status: 'APPROVED', api_key_preview: 'ghk_1234...', api_key_status: 'ACTIVE', api_key_revoked_at: '2026-05-22T10:00:00.000Z' }]), false);
assert.equal(canViewAuditLogsTab('developer', [{ status: 'PENDING', api_key_preview: null }]), false);
assert.equal(canViewAuditLogsTab('reviewer', []), true);
assert.equal(canViewAuditLogsTab('admin', []), true);

assert.deepEqual(
  filterDashboardAuditLogs([
    { event_type: 'SANDBOX_CALL_ALLOWED', mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', api_name: 'NIRA Identity', request_id: 'corr-1' },
    { event_type: 'ACCESS_APPROVED', mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', api_name: 'NIRA Identity', request_id: 'req-1' },
    { event_type: 'SANDBOX_CALL_DENIED', mda_id: 'mda-ppda-e122702f-76bd-46e0-b15f-2c2b93d9928b', api_name: 'URA Tax', request_id: 'corr-2' },
  ], { role: 'developer', filterMda: 'ALL', search: '' }).map(log => log.request_id),
  ['corr-1', 'corr-2']
);

assert.deepEqual(
  filterDashboardAuditLogs([
    { event_type: 'SANDBOX_CALL_ALLOWED', mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', api_name: 'NIRA Identity', request_id: 'corr-1' },
    { event_type: 'SANDBOX_CALL_DENIED', mda_id: 'mda-ppda-e122702f-76bd-46e0-b15f-2c2b93d9928b', api_name: 'URA Tax', request_id: 'corr-2' },
  ], { role: 'admin', filterMda: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', search: 'identity' }).map(log => log.request_id),
  ['corr-1']
);

assert.equal(isMatrixChannelActive(matrix, 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6'), true);
assert.equal(isMatrixChannelActive(matrix, 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65'), false);

assert.deepEqual(
  buildMatrixChannelRows(matrix, 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41').map(row => [row.apiId, row.label, row.active]),
  MATRIX_TARGETS.map(target => [
    target.apiId,
    target.label,
    target.apiId === 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6' || target.apiId === 'api-ura-13897843-012d-4951-8b06-374fff183c3e',
  ])
);

console.log('dashboard view helper tests passed');
