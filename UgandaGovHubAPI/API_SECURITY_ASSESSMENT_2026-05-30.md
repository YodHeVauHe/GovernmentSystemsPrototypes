# API Security Assessment - Uganda GovHub API

Date: 2026-05-30
Remediation update: 2026-05-30
Scope: Static and configuration review of the local repository API surface (`backend/src`, API routing, auth/session logic, access approvals, sandbox API key enforcement, OpenAPI/catalog ingestion, docs access, dependency manifests, and local environment file handling).

Method: OWASP API Security Top 10 guided review using the upstream cybersecurity skills `testing-api-security-with-owasp-top-10`, `testing-api-authentication-weaknesses`, and `testing-api-for-broken-object-level-authorization`.

## Executive Summary

The backend has several strong controls in place: parameterized database access, role-based route middleware, hashed sessions, hashed sandbox API keys, API key expiry/revocation checks, one-time API key reveal, CORS allow-listing, sandbox rate limiting, request size limits, redacted sandbox audit logging, OpenAPI URL SSRF controls, and restricted API documentation visibility.

No production dependency vulnerabilities were reported by `npm audit --omit=dev` for either backend or frontend at assessment time.

The original review identified operational hardening gaps rather than obvious exploitable code injection flaws. The implementation now remediates the four tracked gaps: production admin MFA is fail-closed, production startup rejects demo-mode and missing security secrets, full sandbox API keys are no longer persisted to browser session storage, and the backend test command now runs tests that exist in the current worktree.

## Findings

### 1. Administrator MFA Is Not Enforced By Default

Severity: Medium
OWASP API mapping: API2 Broken Authentication, API5 Broken Function Level Authorization
Status: Remediated

Original evidence:
- `backend/src/auth.ts` only required administrator MFA when `GOVHUB_REQUIRE_ADMIN_MFA === 'true'`.
- Admin-only routes include account approval, suspension/deletion, catalog registration, key expiry, key revocation, and docs visibility changes.

Impact:
If the environment flag is omitted or set incorrectly, highly privileged API governance workflows remain password-only. For a government API gateway/admin portal, password-only admin access is a material risk even with login rate limiting.

Recommendation:
Require MFA for all admin accounts in production by default. Prefer a fail-closed check when `NODE_ENV=production`, with an explicit non-production bypass only for local demos.

Remediation:
- Added `backend/src/security-config.ts`.
- `shouldRequireAdminMfa()` now returns true in production even if `GOVHUB_REQUIRE_ADMIN_MFA` is omitted.
- `backend/src/auth.ts` uses this helper for admin route authorization.
- Covered by `backend/src/auth-production-admin-mfa.test.ts` and `backend/src/security-config.test.ts`.

### 2. Demo Mode Can Weaken Production Secrets And Bootstrap Behavior

Severity: Medium
OWASP API mapping: API8 Security Misconfiguration
Status: Remediated

Original evidence:
- `backend/src/auth.ts` permits missing `GOVHUB_ADMIN_PASSWORD` when `GOVHUB_DEMO_MODE=true`, then logs a generated admin password.
- `backend/src/crypto-at-rest.ts` uses a fixed demo encryption key when `GOVHUB_DATA_ENCRYPTION_KEY` is missing and demo mode is enabled.
- Local `.env.production.local` contains `GOVHUB_DEMO_MODE="true"` based on key inspection.

Impact:
If demo mode is carried into production, encrypted profile data and one-time API key material can be protected by a predictable demo key, and generated bootstrap credentials may appear in logs.

Recommendation:
For production, fail startup when `GOVHUB_DEMO_MODE=true`. Require `GOVHUB_DATA_ENCRYPTION_KEY`, `GOVHUB_ADMIN_PASSWORD`, and `GOVHUB_REQUIRE_ADMIN_MFA=true` in production deployment validation.

Remediation:
- `validateProductionSecurityEnv()` rejects `GOVHUB_DEMO_MODE=true` in production.
- Production startup now requires `GOVHUB_DATA_ENCRYPTION_KEY`, `GOVHUB_ADMIN_PASSWORD`, and `GOVHUB_REQUIRE_ADMIN_MFA=true`.
- `backend/src/index.ts` runs production security validation during initialization.
- `backend/src/crypto-at-rest.ts` no longer permits the fixed demo encryption key in production, even when demo mode is enabled.
- Covered by `backend/src/security-config.test.ts` and `backend/src/crypto-at-rest-production.test.ts`.

### 3. Full Sandbox API Key Is Persisted In Browser Session Storage

Severity: Low to Medium
OWASP API mapping: API2 Broken Authentication, API3 Broken Object Property Level Authorization
Status: Remediated

Original evidence:
- `frontend/src/dashboard/page.tsx` wrote the full revealed API key to `window.sessionStorage` under both a request-specific key and a generic `govhub_api_key`.
- The backend correctly clears the one-time stored key after reveal, but the frontend then persisted a full bearer secret for the browser session.

Impact:
Any frontend XSS, malicious browser extension, shared kiosk, or same-origin script compromise can read the full key until the browser session ends. This partially offsets the backend one-time reveal design.

Recommendation:
Keep the revealed key in memory only, or require manual paste into the sandbox console. If browser persistence is required for demos, make it opt-in, scoped per request/API, short-lived, and clearly segregated from production keys.

Remediation:
- `frontend/src/dashboard/page.tsx` now copies the one-time key to the clipboard without writing it to `sessionStorage`.
- `frontend/src/pages/catalog/SandboxTryItConsole.tsx` no longer reads full approved keys from `sessionStorage`; users must paste a full key as a custom key to call sandbox endpoints.
- Covered by `frontend/src/dashboard/api-key-storage.test.ts`.

### 4. Backend Security Regression Suite Is Not Runnable In Current Worktree

Severity: Medium for assurance, not a direct runtime vulnerability
OWASP API mapping: API8 Security Misconfiguration / secure SDLC control gap
Status: Remediated for current worktree; historical broad test coverage is still absent

Original evidence:
- `backend/package.json` references many security-relevant test files (`src/db.test.ts`, `src/auth.test.ts`, `src/access-control.test.ts`, etc.).
- `npm test` fails at `test:db` because `backend/src/db.test.ts` is missing.
- `npm run typecheck` succeeds, so the failure is not a TypeScript compile failure.

Impact:
The repository advertises broad coverage for auth, access-control races, API key handling, docs leak prevention, SSRF controls, and redaction, but the current worktree cannot execute those checks. This weakens confidence that security controls remain intact after changes.

Recommendation:
Restore the missing tests or update the scripts to match the committed test layout. Treat this as a release gate for security-sensitive API changes.

Remediation:
- `backend/package.json` now runs the backend typecheck plus the committed focused security regression tests.
- `frontend/package.json` now runs the committed frontend key-storage regression test instead of missing historical test files.
- This restores a runnable test gate for the remediated findings. It does not recreate the historical broad suite referenced by old scripts.

## Positive Controls Observed

- Sessions are random, stored as SHA-256 hashes, expire after 24 hours, and are revoked on logout.
- Passwords use per-user random salts with `crypto.scryptSync`.
- Session cookies are `httpOnly`, `sameSite=strict`, `secure` in production, and path-scoped.
- Login is rate-limited by IP and normalized email.
- Signup/login/app-load human verification supports Cloudflare Turnstile and fails closed in production when not configured.
- Sandbox API keys are random, stored hashed for runtime validation, previewed only partially, revocable, expirable, and rate-limited.
- API key reveal is one-time and atomically clears the encrypted key material.
- Sandbox audit paths and bodies redact identifiers, authorization headers, cookies, tokens, secrets, and key-like fields.
- OpenAPI URL imports restrict hosts unless explicitly allowed, block private/local/reserved IP ranges after DNS resolution, reject redirects, apply timeouts, and enforce max response size.
- Documentation visibility supports public, authenticated, and restricted modes; restricted docs require admin/reviewer, owning MDA API owner, or approved consumer access.
- Route mutations use parameterized SQL and role/ownership checks for admin, API owner, reviewer, and developer workflows.

## Verification Performed

- `npm test` in `backend`: passed after remediation.
- `npm test` in `frontend`: passed after remediation.
- `npm test` at repository root: passed after remediation.
- `npm run build` at repository root: passed after remediation; Vite reported the existing large chunk warning.
- Search verification found no `govhub_api_key` full-key persistence references in `frontend/src` or `backend/src`.
- `npm audit --omit=dev` in `backend`: 0 vulnerabilities.
- `npm audit --omit=dev` in `frontend`: 0 vulnerabilities.
- Secret/config check: committed files include only `.env.example`, `backend/.env.example`, and `frontend/.env.example`; local secret-bearing `.env` files are not tracked by git.

## Retest Checklist

1. Run `npm test` from the repository root before release.
2. In a production-like environment, verify startup succeeds only when `GOVHUB_DEMO_MODE=false`, `GOVHUB_DATA_ENCRYPTION_KEY` is set, `GOVHUB_ADMIN_PASSWORD` is set, and `GOVHUB_REQUIRE_ADMIN_MFA=true`.
3. Validate admin routes reject approved admin users without MFA in production.
4. Reveal a sandbox API key and confirm frontend source and browser behavior do not persist full keys to `sessionStorage`.
5. Test OpenAPI URL import with localhost, link-local metadata IPs, private IPs, redirects, oversized responses, and an allowed public host.
