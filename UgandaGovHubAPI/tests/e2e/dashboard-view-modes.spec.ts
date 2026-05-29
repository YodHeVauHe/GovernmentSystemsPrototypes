import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 'user-admin',
  full_name: 'Platform Admin',
  email: 'admin@ict.go.ug',
  account_type: 'government',
  requested_role: 'admin',
  requested_mda_id: 'mda-05',
  requested_organization: 'MoICT',
  requested_purpose: 'Platform oversight',
  status: 'APPROVED',
  role: 'admin',
  mda_id: 'mda-05',
  rejection_reason: null,
  mfa_enabled: true,
};

const pendingAccessRequest = {
  id: 'req-1',
  status: 'PENDING',
  consumer_mda_id: 'mda-06',
  consumer_user_id: 'user-dev',
  mda_name: 'Ministry of Health',
  api_id: 'api-mowt-01',
  api_name: 'Driving Permit Verification API',
  legal_basis: 'Road safety mandate',
  purpose: 'Verify permit status for patient transport drivers',
  requested_fields: 'Permit number, class, expiry',
  volume_tier: 'Low (< 1,000 / month)',
};

async function mockDashboardApis(
  page: Page,
  options: {
    user?: Record<string, unknown>;
    accessRequests?: Array<Record<string, unknown>>;
  } = {}
) {
  const user = options.user || adminUser;
  const accessRequests = options.accessRequests || [pendingAccessRequest];

  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ user }),
      });
      return;
    }

    if (url.pathname === '/api/access') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(accessRequests),
      });
      return;
    }

    if (url.pathname === '/api/access/audit-logs') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'log-1',
            created_at: '2026-05-29T07:00:00.000Z',
            event_type: 'SANDBOX_CALL_DENIED',
            mda_id: 'mda-06',
            mda_name: 'Ministry of Health',
            api_id: 'api-mowt-01',
            api_name: 'Driving Permit Verification API',
            request_id: 'corr-dashboard-view-test',
            correlation_id: 'corr-dashboard-view-test',
            details: 'Policy denied request',
          },
        ]),
      });
      return;
    }

    if (url.pathname === '/api/access/matrix') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { consumer_mda_id: 'mda-06', api_id: 'api-mowt-01' },
          { consumer_mda_id: 'mda-05', api_id: 'api-nira-01' },
        ]),
      });
      return;
    }

    if (url.pathname === '/api/admin/users') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ users: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: `Unhandled mock route: ${url.pathname}` }),
    });
  });
}

test('dashboard tabs keep independent list and grid view modes', async ({ page }) => {
  await mockDashboardApis(page);

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Show access approvals grid view' })).toBeVisible();
  await expect(page.locator('table')).toHaveCount(1);

  await page.getByRole('button', { name: 'Show access approvals grid view' }).click();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText('Road safety mandate')).toBeVisible();

  await page.getByRole('button', { name: 'Audit Trails' }).click();
  await expect(page.locator('table')).toHaveCount(1);
  await page.getByRole('button', { name: 'Show audit trails grid view' }).click();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText('corr-dashboard-view-test')).toBeVisible();

  await page.getByRole('button', { name: 'Interoperability Matrix' }).click();
  await expect(page.locator('table')).toHaveCount(1);
  await page.getByRole('button', { name: 'Show interoperability matrix grid view' }).click();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText('1/5 active').first()).toBeVisible();

  await page.getByRole('button', { name: 'Access Approvals' }).click();
  await expect(page.locator('table')).toHaveCount(0);

  await page.getByRole('button', { name: 'Audit Trails' }).click();
  await expect(page.locator('table')).toHaveCount(0);

  await page.getByRole('button', { name: 'Interoperability Matrix' }).click();
  await expect(page.locator('table')).toHaveCount(0);
});

test('access approvals open request details from list and grid views', async ({ page }) => {
  await mockDashboardApis(page);

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open details for Driving Permit Verification API' }).click();

  const detailsPanel = page.getByRole('region', { name: 'Access request details' });
  await expect(detailsPanel).toBeVisible();
  await expect(detailsPanel).toContainText('Driving Permit Verification API');
  await expect(detailsPanel).toContainText('Road safety mandate');
  await expect(detailsPanel).toContainText('Verify permit status for patient transport drivers');

  await detailsPanel.getByRole('button', { name: 'Close access request details' }).click();
  await expect(detailsPanel).toBeHidden();

  await page.getByRole('button', { name: 'Show access approvals grid view' }).click();
  await page.getByRole('button', { name: 'Open details for Driving Permit Verification API' }).click();

  await expect(detailsPanel).toBeVisible();
  await expect(detailsPanel).toContainText('Permit number, class, expiry');
  await expect(detailsPanel).toContainText('Low (< 1,000 / month)');
});

test('requesters see requested APIs before approval with request statuses', async ({ page }) => {
  await mockDashboardApis(page, {
    user: {
      id: 'user-dev',
      full_name: 'Demo Developer',
      email: 'demo.developer@govhub.go.ug',
      account_type: 'government',
      requested_role: 'developer',
      requested_mda_id: 'mda-06',
      requested_organization: 'Ministry of Health',
      requested_purpose: 'Service integration',
      status: 'APPROVED',
      role: 'developer',
      mda_id: 'mda-06',
      rejection_reason: null,
      mfa_enabled: false,
    },
    accessRequests: [
      pendingAccessRequest,
      {
        id: 'req-2',
        status: 'APPROVED',
        consumer_mda_id: 'mda-06',
        consumer_user_id: 'user-dev',
        mda_name: 'Ministry of Health',
        api_id: 'api-nira-01',
        api_name: 'NIRA Identity Verification API',
        legal_basis: 'Patient identity verification',
        purpose: 'Confirm patient identities during service enrollment',
        requested_fields: 'NIN, name, date of birth',
        volume_tier: 'Medium (1,000 - 10,000 / month)',
        api_key_status: 'ACTIVE',
        api_key_preview: 'gh_live_12345',
      },
    ],
  });

  await page.goto('/dashboard');

  await expect(page.getByText('Driving Permit Verification API')).toBeVisible();
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible();
  await expect(page.getByText('Awaiting approval')).toBeVisible();
  await expect(page.getByText('NIRA Identity Verification API')).toBeVisible();
  await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
  await expect(page.getByText('gh_live_12345')).toBeVisible();

  await page.getByRole('button', { name: 'Show credentials grid view' }).click();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText('Driving Permit Verification API')).toBeVisible();
  await expect(page.getByText('No sandbox key yet')).toBeVisible();
  await expect(page.getByText('NIRA Identity Verification API')).toBeVisible();
  await expect(page.getByText('Try Sandbox')).toBeVisible();
});
