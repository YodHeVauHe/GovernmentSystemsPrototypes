import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 'user-admin',
  full_name: 'Platform Admin',
  email: 'admin@ict.go.ug',
  account_type: 'government',
  requested_role: 'admin',
  requested_mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
  requested_organization: 'MoICT',
  requested_purpose: 'Platform oversight',
  status: 'APPROVED',
  role: 'admin',
  mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
  rejection_reason: null,
  mfa_enabled: false,
};

async function bypassHumanVerification(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('govhub:human-verification:v1', 'verified');
  });
}

async function waitForBackend(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get('http://127.0.0.1:4000/api/health').catch(() => null);
    return response?.ok() ? 'ok' : 'pending';
  }, { timeout: 60_000 }).toBe('ok');
}

async function loginAsAdmin(page: Page) {
  await waitForBackend(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@ict.go.ug');
  await page.getByLabel('Password').fill('AdminPass123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function mockApprovedSession(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ user: adminUser }),
      });
      return;
    }

    if (url.pathname === '/api/catalog') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unhandled mocked API route.' }),
    });
  });
}

test('collapsed sidebar keeps the account menu visually identifiable', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('button', { name: 'Toggle Sidebar' }).click();

  const accountButton = page.locator('[data-sidebar="footer"] [data-sidebar="menu-button"]');
  await expect(accountButton).toBeVisible();
  await expect(accountButton.getByTestId('collapsed-account-icon')).toBeVisible();
});

test('expanded account menu uses the signed-in user initials', async ({ page }) => {
  await loginAsAdmin(page);

  const accountButton = page.locator('[data-sidebar="footer"] [data-sidebar="menu-button"]');
  await expect(accountButton).toBeVisible();
  await expect(accountButton).toContainText('PA');
  await expect(accountButton).not.toContainText('CN');

  await accountButton.click();
  await expect(page.getByRole('menu')).toContainText('PA');
});

test('get help sidebar item opens the help page', async ({ page }) => {
  await bypassHumanVerification(page);
  await mockApprovedSession(page);
  await page.goto('/');

  await page.getByRole('link', { name: 'Get Help' }).click();

  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole('heading', { name: 'Get help' })).toBeVisible();
});
