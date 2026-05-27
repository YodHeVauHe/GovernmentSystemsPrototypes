import { expect, test } from '@playwright/test';

test('unknown brute-force-style routes show a neutral not found page', async ({ page }) => {
  await page.goto('/wp-login.php');

  await expect(page).toHaveURL(/\/wp-login\.php$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('The address does not match an available GovHub workspace page.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to catalog' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
});
