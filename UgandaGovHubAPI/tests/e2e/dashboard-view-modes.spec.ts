import { expect, test, type Page, type Route } from '@playwright/test';

async function mockDashboardApis(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
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
          },
        }),
      });
      return;
    }

    if (url.pathname === '/api/access') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          {
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
          },
        ]),
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
