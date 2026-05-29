import { expect, test } from '@playwright/test';
import { authHeaders, backendUrl, deleteAccessRequestsByPurpose, login, logout } from './support/backend';

async function expectApprovedChannels(page: Page, count: string) {
  const stat = page.getByText('Approved Channels').locator('..');
  await expect(stat.getByText(count, { exact: true })).toBeVisible();
}

test('deleted API keys require admin confirmation and stop counting as approved channels', async ({ page }) => {
  const purpose = `API key lifecycle regression ${Date.now()}`;

  try {
    await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
    const accessResponse = await page.request.post(`${backendUrl}/api/access`, {
      headers: await authHeaders(page),
      data: {
        api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
        consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
        purpose,
        requested_fields: 'NIN, Surname',
        volume_tier: 'Low (< 1,000 / month)',
        legal_basis: 'API key lifecycle regression',
        environment: 'sandbox',
      },
    });
    expect(accessResponse.ok()).toBeTruthy();

    await logout(page);
    await login(page, 'admin@ict.go.ug', 'AdminPass123!');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Access Approvals/i }).click();

    const requestRow = page.getByRole('row').filter({ hasText: purpose });
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole('button', { name: 'Approve key' }).click();
    await expect(page.getByText('API key generated')).toBeVisible();
    await expectApprovedChannels(page, '1');

    await requestRow.getByRole('button', { name: 'API key actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete key' }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete API key?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel' }).click();
    await expect(requestRow).toBeVisible();

    await requestRow.getByRole('button', { name: 'API key actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete key' }).click();
    await confirmation.getByRole('button', { name: 'Delete key' }).click();
    await expect(page.getByText('API key deleted')).toBeVisible();
    await expect(requestRow).toBeHidden();
    await expectApprovedChannels(page, '0');

    await logout(page);
    await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
    await page.goto('/dashboard');
    await expectApprovedChannels(page, '0');
    await page.getByRole('button', { name: 'My Credentials' }).click();
    await expect(page.getByText(purpose)).toBeHidden();
  } finally {
    await deleteAccessRequestsByPurpose(purpose);
  }
});
