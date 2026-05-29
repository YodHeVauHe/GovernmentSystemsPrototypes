# Account Verification Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account settings, privilege display, organization/person verification, and document metadata submission for government employees, public developers, and organizations.

**Architecture:** Extend the existing auth schema with account profile fields, verification status, and document metadata stored in Postgres. Add authenticated account routes and admin review endpoints, then add a React account settings page that reuses `NotificationContext`.

**Tech Stack:** Express 5, pg/Postgres, Node crypto, React 19, React Router, TypeScript.

---

### Task 1: Backend Verification Schema and Rules

**Files:**
- Create: `backend/src/account-verification.ts`
- Create: `backend/src/account-verification.test.ts`
- Modify: `backend/package.json`

- [ ] Write tests for account-type requirements, document requirements, submission readiness, and privilege labels.
- [ ] Run `npm run test:account-verification` and confirm it fails because the module is missing.
- [ ] Implement schema migration, requirement definitions, profile update validation, document upsert, submission checks, and public account serialization helpers.
- [ ] Run `npm run test:account-verification` and confirm it passes.

### Task 2: Backend Account Routes

**Files:**
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/seed.ts`

- [ ] Add `GET /api/account`, `PATCH /api/account/profile`, `POST /api/account/documents`, and `POST /api/account/submit-verification`.
- [ ] Extend admin user list responses with profile, verification, and submitted document summary.
- [ ] Add admin review actions for `needs-more-information`, approve, reject, and suspend.
- [ ] Ensure signup initializes account verification fields.

### Task 3: Frontend Account Settings

**Files:**
- Create: `frontend/src/pages/AccountSettingsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/dashboard/components/nav-user.tsx`
- Modify: `frontend/src/dashboard/components/app-sidebar.tsx`
- Modify: `frontend/src/context/UserContext.tsx`
- Modify: `frontend/src/context/NotificationContext.tsx`

- [ ] Add an account settings page with tabs for profile, organization, verification documents, privileges, notifications, and flow explanation.
- [ ] Reuse `NotificationContext` for both header and account notifications.
- [ ] Link account menu to `/account/settings`.
- [ ] Add route protection so approved users can reach settings and pending users can complete verification.

### Task 4: Verification

**Files:**
- Modify only files needed to fix verification failures.

- [ ] Run backend TypeScript.
- [ ] Run backend account/auth/access tests.
- [ ] Run frontend build.
- [ ] Summarize the implemented flow and limitations.
