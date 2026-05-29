import { expect, test, type Page } from '@playwright/test';
import { backendUrl, deleteAccessRequestsByPurpose, getCurrentUserId, login, logout } from './support/backend';

async function seedAccountNotification(page: Page, userId: string, message: string) {
  await page.evaluate(({ message, userId }) => {
    const notification = {
      id: 'notification-account-scope-regression',
      type: 'account',
      title: 'Account-scoped notice',
      message,
      createdAt: new Date().toISOString(),
      read: false,
    };

    localStorage.setItem('govhub_notifications', JSON.stringify([notification]));
    localStorage.setItem(`govhub_notifications:${userId}`, JSON.stringify([notification]));
  }, { message, userId });
}

test('notifications are scoped to the signed-in account', async ({ page }) => {
  const notificationMessage = 'Only the API owner should see this notification.';
  const apiOwnerNotification = `Demo API Owner (API Owner, NIRA): ${notificationMessage}`;

  await login(page, 'demo.api.owner@nira.go.ug', 'DemoApiOwner123!');
  const apiOwnerId = await getCurrentUserId(page);
  await seedAccountNotification(page, apiOwnerId, notificationMessage);
  await page.goto('/account/settings?tab=notifications');
  await expect(page.getByText(apiOwnerNotification)).toBeVisible();

  await logout(page);
  await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
  await page.goto('/account/settings?tab=notifications');
  await expect(page.getByText(notificationMessage)).not.toBeVisible();
});

test('access approval notification is delivered to the requesting user', async ({ page }) => {
  const purpose = `Notification delivery regression ${Date.now()}`;
  const expectedDeveloperMessage = 'Demo Developer (Developer, MoH): Your access request to NIRA Identity Verification API was approved for Ministry of Health.';

  try {
    await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
    const accessResponse = await page.request.post(`${backendUrl}/api/access`, {
      data: {
        api_id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
        consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
        purpose,
        requested_fields: 'NIN, Surname',
        volume_tier: 'Low (< 1,000 / month)',
        legal_basis: 'Notification delivery regression',
        environment: 'sandbox',
      },
    });
    expect(accessResponse.ok()).toBeTruthy();

    await logout(page);
    await login(page, 'demo.api.owner@nira.go.ug', 'DemoApiOwner123!');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Access Approvals/i }).click();
    const requestRow = page.getByRole('row').filter({ hasText: purpose });
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole('button', { name: 'Approve key' }).click();
    await expect(page.getByText('API key generated')).toBeVisible();

    await logout(page);
    await login(page, 'demo.developer@govhub.go.ug', 'DemoDeveloper123!');
    await page.goto('/account/settings?tab=notifications');
    await expect(page.getByText(expectedDeveloperMessage)).toBeVisible();
  } finally {
    await deleteAccessRequestsByPurpose(purpose);
  }
});
