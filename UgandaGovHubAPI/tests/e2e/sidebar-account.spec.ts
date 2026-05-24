import { expect, test, type Page } from '@playwright/test';

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
