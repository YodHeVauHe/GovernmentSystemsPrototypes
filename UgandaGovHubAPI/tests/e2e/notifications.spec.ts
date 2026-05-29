import { expect, test, type Page } from '@playwright/test';
import Database from '../../backend/node_modules/better-sqlite3';

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

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function getCurrentUserId(page: Page) {
  const response = await page.request.get('http://127.0.0.1:4000/api/auth/me');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.user.id as string;
}

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

function deleteAccessRequestsByPurpose(purpose: string) {
  const db = new Database('backend/data/govhub.db');
  try {
    const rows = db.prepare('SELECT id FROM access_requests WHERE purpose = ?').all(purpose) as Array<{ id: string }>;
    const removeRows = db.transaction(() => {
      for (const row of rows) {
        db.prepare('DELETE FROM audit_logs WHERE request_id = ?').run(row.id);
        db.prepare('DELETE FROM access_requests WHERE id = ?').run(row.id);
      }
    });
    removeRows();
  } finally {
    db.close();
  }
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
    const accessResponse = await page.request.post('http://127.0.0.1:4000/api/access', {
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
    deleteAccessRequestsByPurpose(purpose);
  }
});
