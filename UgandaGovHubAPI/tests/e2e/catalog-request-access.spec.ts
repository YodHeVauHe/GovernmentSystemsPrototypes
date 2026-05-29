import { expect, test, type Page, type Route } from '@playwright/test';

const developerUser = {
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
};

const catalogApi = {
  id: 'api-nira-01',
  name: 'NIRA Identity Verification API',
  description: 'Verify citizen identity records for governed service delivery.',
  owning_mda_id: 'mda-01',
  owning_mda_name: 'National Identification and Registration Authority',
  lifecycle_status: 'Production',
  sensitivity_level: 'Medium',
  interoperability_domain: 'Identity',
  legal_basis: 'Registration of Persons Act',
  personal_data_categories: 'NIN, name, date of birth',
  retention_class: 'Operational',
  openapi_spec_path: '/specs/api-nira-01.yaml',
};

const catalogSpec = {
  openapi: '3.0.0',
  info: {
    title: 'NIRA Identity Verification API',
    version: '1.0.0',
  },
  servers: [{ url: 'https://sandbox.govhub.go.ug/nira' }],
  paths: {
    '/verify': {
      post: {
        summary: 'Verify identity',
        responses: {
          '200': { description: 'Identity matched' },
        },
      },
    },
  },
};

async function mockCatalogDetailApis(page: Page, accessRequests: Array<Record<string, unknown>>) {
  await page.route('**/api/**', async (route: Route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());

    if (url.pathname === '/api/auth/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ user: developerUser }),
      });
      return;
    }

    if (url.pathname === '/api/catalog/api-nira-01') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(catalogApi),
      });
      return;
    }

    if (url.pathname === '/api/catalog/api-nira-01/spec') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(catalogSpec),
      });
      return;
    }

    if (url.pathname === '/api/catalog/api-nira-01/versions') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([]),
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
        body: JSON.stringify({ ok: true }),
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

test('catalog disables duplicate access requests while review is pending', async ({ page }) => {
  await mockCatalogDetailApis(page, [
    {
      id: 'req-pending',
      status: 'PENDING',
      consumer_mda_id: 'mda-06',
      consumer_user_id: 'user-dev',
      api_id: 'api-nira-01',
      api_name: 'NIRA Identity Verification API',
    },
  ]);

  await page.goto('/api/api-nira-01');

  await expect(page.getByRole('button', { name: 'Request pending review' })).toBeDisabled();
});

test('catalog lets requesters appeal after access is revoked or deleted', async ({ page }) => {
  await mockCatalogDetailApis(page, [
    {
      id: 'req-revoked',
      status: 'APPROVED',
      api_key_status: 'REVOKED',
      consumer_mda_id: 'mda-06',
      consumer_user_id: 'user-dev',
      api_id: 'api-nira-01',
      api_name: 'NIRA Identity Verification API',
    },
  ]);

  await page.goto('/api/api-nira-01');

  const appealButton = page.getByRole('button', { name: 'Appeal request' });
  await expect(appealButton).toBeEnabled();
  await appealButton.click();
  await expect(page.getByRole('heading', { name: 'Request API Access' })).toBeVisible();
});
