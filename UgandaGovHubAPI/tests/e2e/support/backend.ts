import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { createDb, run } from '../../../backend/src/db';

export const backendPort = Number(process.env.E2E_BACKEND_PORT || 4000);
export const backendUrl = `http://127.0.0.1:${backendPort}`;

function readBackendEnvValue(key: string) {
  const envFiles = [
    path.join(process.cwd(), 'backend/.env'),
    path.join(process.cwd(), 'backend/.env.example'),
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    const lines = readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match?.[1] === key) {
        return match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }

  return undefined;
}

function ensurePostgresEnv() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
    process.env.DATABASE_URL = readBackendEnvValue('DATABASE_URL');
  }
  if (!process.env.DATABASE_SSL) {
    process.env.DATABASE_SSL = readBackendEnvValue('DATABASE_SSL') || 'false';
  }
}

export async function waitForBackend(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get(`${backendUrl}/api/health`).catch(() => null);
    return response?.ok() ? 'ok' : 'pending';
  }, { timeout: 60_000 }).toBe('ok');
}

export async function login(page: Page, email: string, password: string) {
  await waitForBackend(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function authHeaders(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem('govhub_auth_token'));
  expect(token).toBeTruthy();
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

export async function getCurrentUserId(page: Page) {
  const response = await page.request.get(`${backendUrl}/api/auth/me`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.user.id as string;
}

export async function deleteAccessRequestsByPurpose(purpose: string) {
  ensurePostgresEnv();
  const db = createDb();

  try {
    await db.transaction(async client => {
      await run(client, 'DELETE FROM audit_logs WHERE request_id IN (SELECT id FROM access_requests WHERE purpose = $1)', [purpose]);
      await run(client, 'DELETE FROM access_requests WHERE purpose = $1', [purpose]);
    });
  } finally {
    await db.close();
  }
}
