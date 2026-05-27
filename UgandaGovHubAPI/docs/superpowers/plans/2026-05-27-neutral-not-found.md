# Neutral Not Found Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a neutral 404 page for unknown frontend routes without changing behavior for known protected routes.

**Architecture:** Keep routing centralized in `frontend/src/App.tsx`. Add a focused `NotFoundPage` component under `frontend/src/pages`, classify known app paths before global auth redirects, and add a `*` route in both auth-only and shell route trees.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Playwright.

---

### Task 1: Unknown Route Test

**Files:**
- Create: `tests/e2e/not-found.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from '@playwright/test';

test('unknown brute-force-style routes show a neutral not found page', async ({ page }) => {
  await page.goto('/wp-login.php');

  await expect(page).toHaveURL(/\/wp-login\.php$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('The address does not match an available GovHub workspace page.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return to catalog' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/e2e/not-found.spec.ts`
Expected: FAIL because `/wp-login.php` redirects to `/login` or lacks the fallback heading.

### Task 2: Fallback Page

**Files:**
- Create: `frontend/src/pages/NotFoundPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="flex h-full min-h-[calc(100dvh-var(--header-height,48px))] items-center justify-center bg-[#181818] px-5 py-10 text-white">
      <section className="w-full max-w-xl border border-[#2b2b2b] bg-[#1f1f1f] p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-[#3a3a3a] bg-[#242424] text-[#3ecf8e]">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b8b8b]">404</p>
        <h1 className="text-2xl font-semibold tracking-normal text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-[#b4b4b4]">
          The address does not match an available GovHub workspace page.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-9 items-center gap-2 rounded-md bg-[#3ecf8e] px-3 text-sm font-medium text-[#111] transition hover:bg-[#58dba0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to catalog
        </Link>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Wire the route**

Import `NotFoundPage`, compute whether the current path is known before global auth redirects, and add `<Route path="*" element={<NotFoundPage />} />`.

- [ ] **Step 3: Run test to verify it passes**

Run: `npx playwright test tests/e2e/not-found.spec.ts`
Expected: PASS.

### Task 3: Build Verification

**Files:**
- Verify: `frontend/src/App.tsx`
- Verify: `frontend/src/pages/NotFoundPage.tsx`

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: frontend TypeScript and Vite build complete successfully.
