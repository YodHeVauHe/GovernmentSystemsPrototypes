# Authentication and Admin Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build login, sign up, session authentication, and admin user verification for the Uganda GovHub API portal.

**Architecture:** Add focused backend auth helpers and routes, then wire Express middleware into protected routes. Update the React user context so authenticated server state replaces local role impersonation, with login, sign up, and account-status pages.

**Tech Stack:** Express 5, better-sqlite3, Node crypto, React 19, React Router, TypeScript.

---

### Task 1: Backend Auth Core

**Files:**
- Create: `backend/src/auth.ts`
- Test: `backend/src/auth.test.ts`
- Modify: `backend/package.json`

- [ ] Write failing tests for password hashing, signup normalization, token creation, and access decisions.
- [ ] Run `npm run test:auth` in `backend` and confirm it fails because `auth.ts` is missing.
- [ ] Implement `ensureAuthSchema`, password hashing/verification, session creation, signup validation, public user serialization, and role/status access helpers.
- [ ] Run `npm run test:auth` and confirm it passes.

### Task 2: Backend Auth Routes and Protection

**Files:**
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/routes/access.ts`
- Test: `backend/src/auth-routes.test.ts`

- [ ] Write failing route-level tests for signup, login, `/me`, pending-user blocking, admin approval, and role enforcement.
- [ ] Run `npm run test:auth-routes` in `backend` and confirm the expected failures.
- [ ] Mount `/api/auth` and `/api/admin/users`, apply authentication middleware to protected access and catalog mutations, and seed a default admin.
- [ ] Run `npm run test:auth-routes` and confirm it passes.

### Task 3: Frontend Auth Experience

**Files:**
- Modify: `frontend/src/context/UserContext.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/dashboard/components/app-sidebar.tsx`
- Modify: `frontend/src/dashboard/components/nav-user.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/SignupPage.tsx`
- Create: `frontend/src/pages/AccountStatusPage.tsx`

- [ ] Update `UserContext` to load `/api/auth/me`, store bearer token, expose `login`, `signup`, and `logout`, and derive role/MDA from approved server user data.
- [ ] Add login, sign up, and account-status pages.
- [ ] Gate protected routes while keeping the catalog visible to public visitors.
- [ ] Update sidebar user display and logout to use authenticated user state.
- [ ] Run `npm run build` in `frontend` and fix TypeScript or bundling errors.

### Task 4: Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] Run backend auth tests.
- [ ] Run frontend build.
- [ ] Run existing backend unit tests.
- [ ] Summarize remaining security limitations, especially prototype session storage and default seeded admin credentials.
