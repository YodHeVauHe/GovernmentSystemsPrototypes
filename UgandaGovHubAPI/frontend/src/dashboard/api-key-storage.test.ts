import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  filterDashboardAuditLogs,
  filterPersonalApiCallLogs,
  getAuditLogEndpoint,
  getAuditLogResponseStatus,
  getAuditLogResponseStatusLabel,
  getVisibleDashboardTabs,
} from './view-helpers';
import { formatHttpStatusLabel } from '../lib/http-status';
import { redactHeaderMap } from '../lib/header-redaction';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const appShell = fs.readFileSync(path.join(currentDir, '..', 'App.tsx'), 'utf8');
const dashboardPage = fs.readFileSync(path.join(currentDir, 'page.tsx'), 'utf8');
const accountsPanel = fs.readFileSync(path.join(currentDir, 'page-components', 'AccountsPanel.tsx'), 'utf8');
const endpointBlock = fs.readFileSync(
  path.join(currentDir, '..', 'pages', 'catalog', 'EndpointBlock.tsx'),
  'utf8'
);
const sandboxConsole = fs.readFileSync(
  path.join(currentDir, '..', 'pages', 'catalog', 'SandboxTryItConsole.tsx'),
  'utf8'
);
const apiDetail = fs.readFileSync(
  path.join(currentDir, '..', 'pages', 'catalog', 'ApiDetail.tsx'),
  'utf8'
);

assert.equal(
  dashboardPage.includes('sessionStorage.setItem'),
  false,
  'Dashboard must not persist full sandbox API keys in sessionStorage.'
);

assert.equal(
  dashboardPage.includes("['admin', 'developer'].includes(role)"),
  false,
  'Dashboard must not attempt one-time API key reveal from admin sessions.'
);

assert.equal(
  dashboardPage.includes("role !== 'developer'"),
  true,
  'Dashboard one-time API key reveal should be limited to developer sessions.'
);

assert.equal(
  apiDetail.includes("const canRequestApiAccess = role === 'developer';"),
  true,
  'Catalog access requests should be initiated only by developer sessions.'
);

assert.equal(
  sandboxConsole.includes('<option value="approved">Approved Key</option>'),
  false,
  'Sandbox console must not offer a preview-only approved key mode that sends no API key header.'
);

assert.equal(
  sandboxConsole.includes("customApiKey.trim()"),
  true,
  'Sandbox console should send a pasted custom API key without surrounding whitespace.'
);

assert.equal(
  sandboxConsole.includes('requestHeaders: sentHeaders'),
  false,
  'Sandbox response console must not display raw request headers that can contain pasted API keys or custom credentials.'
);

assert.equal(
  sandboxConsole.includes('redactSandboxRequestHeaders(sentHeaders)'),
  true,
  'Sandbox response console should redact sensitive request headers before storing them for display.'
);

assert.equal(
  sandboxConsole.includes('headers: headersObj'),
  false,
  'Sandbox response console must not display raw response headers that can contain credentials.'
);

assert.equal(
  sandboxConsole.includes('headers: redactHeaderMap(headersObj)'),
  true,
  'Sandbox response console should redact sensitive response headers before storing them for display.'
);

assert.deepEqual(
  redactHeaderMap({
    'X-GovHub-API-Key': 'gh_live_secret',
    Authorization: 'Bearer secret-token',
    Cookie: 'govhub_session=session-secret',
    Password: 'plain-password',
    'X-Client-Secret': 'client-secret',
    'X-Credential-ID': 'credential-id',
    'X-Request-ID': 'request-id',
  }),
  {
    'X-GovHub-API-Key': '[REDACTED]',
    Authorization: '[REDACTED]',
    Cookie: '[REDACTED]',
    Password: '[REDACTED]',
    'X-Client-Secret': '[REDACTED]',
    'X-Credential-ID': '[REDACTED]',
    'X-Request-ID': 'request-id',
  },
  'Header redaction should cover common custom credential header names without hiding safe request IDs.'
);

const sandboxLog = {
  event_type: 'SANDBOX_CALL_ALLOWED',
  consumer_user_id: 'user-admin',
  details: JSON.stringify({
    method: 'GET',
    path: '/api/v1/transport/driving-permit/status/WP30219',
    response_status: 404,
    response_body: { error: { code: 'PERMIT_NOT_FOUND' } },
  }),
};

assert.equal(
  getAuditLogEndpoint(sandboxLog),
  'GET /api/v1/transport/driving-permit/status/WP30219',
  'Audit logs should expose the attempted sandbox endpoint.'
);

assert.equal(
  filterDashboardAuditLogs([sandboxLog], { role: 'admin', filterMda: 'ALL', search: 'WP30219' }).length,
  1,
  'Audit log search should match attempted endpoints.'
);

assert.equal(
  getAuditLogResponseStatus(sandboxLog),
  404,
  'Audit logs should expose the sandbox response code.'
);

assert.equal(
  getAuditLogResponseStatusLabel(sandboxLog),
  '404 Not Found',
  'Audit logs should label response codes with HTTP reason text.'
);

assert.equal(
  formatHttpStatusLabel(401),
  '401 Unauthorized',
  'HTTP status labels should include reason text.'
);

assert.equal(
  getVisibleDashboardTabs('admin', true).includes('apiLogs'),
  true,
  'Platform admins should have a dedicated API call logs dashboard destination.'
);

assert.equal(
  dashboardPage.includes("if (role === 'admin')"),
  true,
  'Platform admins should branch into the secondary side menu layout.'
);

assert.equal(
  dashboardPage.includes('<AdminDashboardSideMenu'),
  true,
  'Platform admin dashboard should render the Supabase-style secondary side menu.'
);

assert.equal(
  dashboardPage.includes('<main className="min-w-0 flex-1 overflow-hidden">') &&
    dashboardPage.includes('mx-auto flex h-full min-h-0 w-full max-w-[1400px]'),
  true,
  'Platform admin secondary-menu pages should keep scrolling inside their panels, not on the whole page.'
);

assert.equal(
  dashboardPage.includes('<DashboardTabs'),
  true,
  'Non-admin dashboard roles should keep the existing top tab navigation.'
);

assert.equal(
  appShell.includes("dashboardPage && role === 'admin'"),
  true,
  'Opening the platform admin dashboard should collapse the primary sidebar.'
);

assert.equal(
  accountsPanel.includes('flex-nowrap') && accountsPanel.match(/flex shrink-0 items-center/g)?.length === 2,
  true,
  'Account status filters and view toggle should stay in the same header row.'
);

assert.equal(
  endpointBlock.includes('formatHttpStatusLabel(code)'),
  false,
  'Catalog response tabs should display only HTTP status codes, not reason text.'
);

assert.deepEqual(
  filterPersonalApiCallLogs([
    sandboxLog,
    { ...sandboxLog, consumer_user_id: 'other-user' },
  ], { userId: 'user-admin', mdaId: null, search: 'WP30219' }),
  [sandboxLog],
  'Platform admin API call logs should show only calls made by that admin identity.'
);
