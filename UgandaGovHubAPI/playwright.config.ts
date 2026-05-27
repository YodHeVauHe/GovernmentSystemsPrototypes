import { defineConfig, devices } from '@playwright/test';

const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 5173);
const backendPort = Number(process.env.E2E_BACKEND_PORT || 4000);
const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run seed && concurrently -k "cd backend && PORT=${backendPort} HOST=127.0.0.1 GOVHUB_ALLOWED_ORIGINS=${frontendUrl} npm run dev" "cd frontend && VITE_API_BASE_URL=${backendUrl} npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort"`,
    url: frontendUrl,
    reuseExistingServer: process.env.E2E_REUSE_EXISTING_SERVER === 'true',
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
