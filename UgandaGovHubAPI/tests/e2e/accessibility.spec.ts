import { expect, test, type Page } from '@playwright/test';
import { source as axeSource } from 'axe-core';

declare global {
  interface Window {
    axe: {
      run: (context: Document, options: unknown) => Promise<{
        violations: Array<{ impact: string | null }>;
      }>;
    };
  }
}

async function login(page: Page) {
  await waitForBackend(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@ict.go.ug');
  await page.getByLabel('Password').fill('AdminPass123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForBackend(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get('http://127.0.0.1:4000/api/health').catch(() => null);
    return response?.ok() ? 'ok' : 'pending';
  }, { timeout: 60_000 }).toBe('ok');
}

async function checkAccessibility(page: Page, label: string) {
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => {
    return await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    });
  });
  const blockingViolations = results.violations.filter(violation => violation.impact === 'critical');

  expect(blockingViolations, `${label} has critical accessibility violations`).toEqual([]);
}

test('core demo pages pass automated accessibility checks', async ({ page }) => {
  await waitForBackend(page);
  await page.goto('/login');
  await checkAccessibility(page, 'Login page');

  await login(page);
  await checkAccessibility(page, 'Dashboard');

  await page.goto('/');
  await checkAccessibility(page, 'Catalog');

  await page.goto('/api/api-nira-01');
  await checkAccessibility(page, 'NIRA API detail');

  await page.goto('/catalog/add');
  await checkAccessibility(page, 'Add API');
});
