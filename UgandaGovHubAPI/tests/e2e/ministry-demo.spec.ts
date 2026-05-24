import { expect, test, type Page } from '@playwright/test';

async function waitForBackend(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get('http://127.0.0.1:4000/api/health').catch(() => null);
    return response?.ok() ? 'ok' : 'pending';
  }, { timeout: 60_000 }).toBe('ok');
}

async function login(page: Page, email: string, password: string) {
  await waitForBackend(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function loginAsDeveloper(page: Page) {
  await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
}

async function loginAsAdmin(page: Page) {
  await login(page, 'admin@ict.go.ug', 'AdminPass123!');
}

async function logout(page: Page) {
  await page.evaluate(() => localStorage.removeItem('govhub_auth_token'));
}

test('seeded demo accounts can be used by presenters', async ({ page }) => {
  await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
  await expect(page.getByText('Developer').first()).toBeVisible();

  await logout(page);
  await login(page, 'admin@ict.go.ug', 'AdminPass123!');
  await expect(page.getByText('Admin').first()).toBeVisible();

  await logout(page);
  await login(page, 'demo.reviewer@govhub.go.ug', 'DemoReviewer123!');
  await expect(page.getByText('Compliance Reviewer').first()).toBeVisible();
});

test('ministry presenter path covers request, approval, sandbox, and audit surfaces', async ({ page }) => {
  await loginAsDeveloper(page);

  await page.goto('/api/api-nira-01');
  await expect(page.getByRole('heading', { name: /NIRA Identity Verification API/i })).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('govhub_auth_token'));
  const accessResponse = await page.request.post('http://127.0.0.1:4000/api/access', {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    data: {
      api_id: 'api-nira-01',
      consumer_mda_id: 'mda-06',
      purpose: 'Verify citizen identity for a controlled ministry service eligibility demonstration.',
      requested_fields: 'NIN, Surname, Given Name, Date of Birth',
      volume_tier: 'Low (< 1,000 / month)',
      legal_basis: 'Ministry service eligibility verification mandate',
      environment: 'sandbox',
    },
  });
  expect(accessResponse.ok()).toBeTruthy();

  await logout(page);
  await loginAsAdmin(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Access Approvals/i }).click();
  await expect(page.getByRole('button', { name: /Approve key/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /Approve key/i }).first().click();
  await expect(page.getByText(/API key generated/i)).toBeVisible();

  await logout(page);
  await loginAsDeveloper(page);
  await page.goto('/api/api-nira-01');
  await page.getByRole('button', { name: 'Sandbox Try It' }).click();
  const sandboxDialog = page.getByRole('dialog', { name: 'Sandbox Console Simulator' });
  if (!(await sandboxDialog.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Open Sandbox Simulator' }).click();
  }
  await expect(sandboxDialog).toBeVisible();
  await page.getByRole('button', { name: 'Send Request' }).click();
  await expect(page.getByText(/STATUS:/)).toBeVisible();

  await logout(page);
  await loginAsAdmin(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Audit Trails' }).click();
  await expect(page.getByText('Platform Governance Audit Log')).toBeVisible();
  await page.getByRole('button', { name: 'Interoperability Matrix' }).click();
  await expect(page.getByText('Government Data Interoperability Channels')).toBeVisible();
});
