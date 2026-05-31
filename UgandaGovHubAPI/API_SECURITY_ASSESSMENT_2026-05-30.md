# API Security Assessment - Uganda GovHub API

Date: 2026-05-30
Remediation update: 2026-05-30
Additional remediation update: 2026-05-31
Scope: Static and configuration review of the local repository API surface (`backend/src`, API routing, auth/session logic, access approvals, sandbox API key enforcement, OpenAPI/catalog ingestion, docs access, dependency manifests, and local environment file handling).

Method: OWASP API Security Top 10 guided review using the upstream cybersecurity skills `testing-api-security-with-owasp-top-10`, `performing-ssrf-vulnerability-exploitation`, `testing-api-authentication-weaknesses`, `testing-api-for-broken-object-level-authorization`, `testing-api-for-mass-assignment-vulnerability`, `detecting-broken-object-property-level-authorization`, `testing-for-broken-access-control`, `testing-for-business-logic-vulnerabilities`, and `testing-for-sensitive-data-exposure`.

## Executive Summary

The backend has several strong controls in place: parameterized database access, role-based route middleware, hashed sessions, hashed sandbox API keys, API key expiry/revocation checks, developer-only one-time API key reveal, CORS allow-listing, sandbox rate limiting, request size limits, redacted sandbox audit logging, OpenAPI URL SSRF controls with DNS-pinned outbound requests and streamed size enforcement, and restricted API documentation visibility.

No production dependency vulnerabilities were reported by `npm audit --omit=dev` for either backend or frontend at assessment time.

The original review identified operational hardening gaps rather than obvious exploitable code injection flaws. The implementation now remediates the tracked gaps: production admin MFA is fail-closed, authenticated MFA mutation attempts and login-time MFA code guesses are rate-limited per user, signup and MFA confirmation passwords are bounded before hashing or verification, public user responses omit password hashes, MFA secrets, and MFA enablement timestamps, suspended accounts have active sessions revoked, production startup rejects demo-mode and missing security secrets, production data encryption keys must be explicit 32-byte keys, malformed encrypted-field prefixes are re-encrypted instead of being trusted, full sandbox API keys are no longer persisted to browser session storage or echoed in sandbox response headers, access request submission and one-time API key reveal are limited to developer consumers before key material can be claimed, sandbox and production access-request lifecycles are separated in duplicate-request checks, the backend test command now runs tests that exist in the current worktree, production Turnstile configuration rejects test secrets and missing hostname validation, Turnstile upstream verification is bounded by a fail-closed timeout, Turnstile-backed login/signup/app-load verification is locally rate-limited before upstream calls, production database TLS rejects certificate-verification bypasses, production CORS requires explicit HTTPS non-localhost origins, production OpenAPI URL imports require trusted HTTPS hosts, pin the outbound request to the DNS address vetted by SSRF preflight, and enforce body-size limits while streaming, inline OpenAPI specs now use the same configured byte ceiling as URL imports, OpenAPI path keys and server URLs must remain safe relative inputs that cannot normalize into external authority URLs, cyclic YAML aliases are rejected before OpenAPI specs are stored or parsed from existing rows for JSON responses, recursive OpenAPI schemas are bounded during frontend example generation, API responses include defensive headers, docs/catalog/OpenAPI responses use no-store cache controls, account-verification snapshots no longer expose internal document storage locators, document uploads no longer accept client-supplied storage references, the frontend no longer generates or posts internal document storage locators, sandbox audit/log paths and bodies redact canonical and common alias identifiers, common PII aliases, and unlabeled identifier/contact values, sandbox route resolution enforces catalog `sandbox_available` controls for built-in and dynamic APIs, sandbox runtime authorization rejects production-scoped access-request keys, missing or malformed sandbox API-key requests are throttled before catalog availability and access-request lookups, privileged audit-log API-call filtering preserves cross-consumer review visibility, catalog version mutations re-check API ownership inside the write transaction, account role assignment plus MDA assignment requirements are constrained by verified account category, and project-local ignore rules now cover root/backend/frontend env variants so production-style local secret files are less likely to be committed if this project is moved or split out.

The additional session review also rejects duplicate `govhub_session` cookies so ambiguous cookie headers cannot silently select an attacker-controlled, stale, or path-confused session value.

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

### 5. Production Turnstile Configuration Can Use Test Secrets Or Skip Hostname Validation

Severity: Medium
OWASP API mapping: API2 Broken Authentication, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `validateProductionSecurityEnv()` did not require a Turnstile secret, did not reject Cloudflare test secrets, and did not require `GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES`.
- `validateTurnstileToken()` skips action and hostname checks for Cloudflare test secrets by design for local development.

Impact:
If a production deployment reused local test keys or omitted the hostname allow-list, human-verification controls could be weaker than intended or fail only at runtime.

Remediation:
- Production startup now requires `GOVHUB_TURNSTILE_SECRET_KEY` or `TURNSTILE_SECRET_KEY`.
- Cloudflare test secrets are rejected in production.
- `GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES` is required in production.
- Covered by `backend/src/security-config.test.ts`.

### 6. Database TLS Certificate Verification Is Disabled By Default

Severity: Medium
OWASP API mapping: API8 Security Misconfiguration
Status: Remediated

Evidence:
- `backend/src/db.ts` configured Postgres SSL as `{ rejectUnauthorized: false }` whenever `DATABASE_SSL` was not explicitly `false`.

Impact:
Hosted database connections could be encrypted but not authenticated, weakening protection against network interception or endpoint impersonation.

Remediation:
- Database SSL now defaults to `{ rejectUnauthorized: true }`.
- Production startup rejects `DATABASE_SSL=false` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
- Covered by `backend/src/db-security.test.ts` and `backend/src/security-config.test.ts`.

### 7. OpenAPI URL Import Can Be Relaxed To Unlisted Or Plain HTTP Hosts In Production

Severity: Medium
OWASP API mapping: API7 Server-Side Request Forgery, API8 Security Misconfiguration, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `fetchSpecFromUrl()` allowed `http:` URLs.
- Production startup did not reject `GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true`.

Impact:
Even with private-address DNS checks, production operators could allow arbitrary public spec hosts or fetch specs over unauthenticated transport, increasing SSRF and spec-tampering risk.

Remediation:
- Production spec URL imports now require `https:`.
- Production startup rejects `GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true`.
- Covered by `backend/src/catalog-spec-url-security.test.ts` and `backend/src/security-config.test.ts`.

### 8. Defensive Security Headers Are Not Centralized

Severity: Low to Medium
OWASP API mapping: API8 Security Misconfiguration
Status: Remediated

Evidence:
- The backend emitted HSTS only when TLS was enabled or trusted via proxy, but did not consistently emit `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or a restrictive `Permissions-Policy`.
- Sensitive auth/admin/access API responses did not have a central no-store cache policy.

Impact:
Missing defensive headers leave browsers with weaker defaults for content sniffing, framing, referrer leakage, permissions surfaces, and local/proxy caching of sensitive API responses.

Remediation:
- Added a shared security-header middleware.
- Auth, admin, and access API paths now receive `Cache-Control: no-store` and `Pragma: no-cache`.
- Covered by `backend/src/security-headers.test.ts`.

### 9. Account Snapshot Documents Expose Internal Storage References

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `getAccountSnapshot()` decrypted `verification_documents.storage_ref` and returned it in `documents`.
- The account settings document UI displayed `Ref: {submittedDoc.storage_ref}`.

Impact:
Authenticated users could see internal document storage locators such as `s3://govhub-vault/docs/...`, `metadata://...`, or local storage paths. These values are not needed for the client review workflow and unnecessarily disclose backend storage layout.

Remediation:
- Added a public document response type that omits `storage_ref`.
- `getAccountSnapshot()` now strips `storage_ref` from returned documents while preserving it for write/storage paths.
- The frontend account document type and UI no longer expose the reference.
- Covered by `backend/src/account-verification-security.test.ts`.

### 10. Canonical Driving-Permit Sandbox Paths Leak Permit Numbers In Logs

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `normalizeSandboxLogPath()` redacted the compatibility path `/api/v1/transport/driving-permit/status/:permitNumber`.
- The canonical route is `/api/v1/transport/driving-permit/:permitNumber/status`, which was not covered by the path redaction pattern.

Impact:
Permit numbers in canonical sandbox URLs could be written to console logs and sandbox audit-log `path` fields in clear text.

Remediation:
- Added canonical driving-permit path redaction before sandbox audit/log persistence.
- Preserved the existing compatibility-path redaction behavior.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 11. Production CORS Allows Missing Or Insecure Origins

Severity: Low to Medium
OWASP API mapping: API8 Security Misconfiguration
Status: Remediated

Evidence:
- `backend/src/index.ts` defaults `GOVHUB_ALLOWED_ORIGINS` to `http://localhost:5173,http://127.0.0.1:5173`.
- Production startup validation did not require an explicit CORS origin allow-list and did not reject `http:` origins.

Impact:
A production deployment with omitted CORS configuration could start with local development origins rather than the intended deployed frontend origins. A deployment with `http:` origins could also permit protocol-downgrade browser access to credentialed API responses. This is a browser-boundary misconfiguration and can mask a broken or insecure production deployment until runtime.

Remediation:
- Production startup now requires `GOVHUB_ALLOWED_ORIGINS`.
- `GOVHUB_ALLOWED_ORIGINS` must contain valid HTTPS origins in production.
- Localhost and loopback origins are rejected in production CORS configuration.
- Covered by `backend/src/security-config.test.ts`.

### 12. Sandbox Audit Body Redaction Misses Common Identifier Aliases

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `redactSandboxLogValue()` redacted short identifier keys such as `nin`, `tin`, `brn`, and `permitNumber`.
- Common OpenAPI-style aliases such as `nationalId`, `businessRegistrationNumber`, and `taxIdentificationNumber` were not treated as sensitive log keys.

Impact:
Sandbox audit logs could persist national ID, business registration, or tax identifier values in clear text when upstream OpenAPI examples or request bodies used expanded field names instead of the shorter internal aliases.

Remediation:
- Expanded sandbox audit redaction to cover common identifier aliases including national ID, tax identification number, taxpayer identification number, and business registration number variants.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 13. Catalog Version Mutations Trust A Stale Pre-Transaction Ownership Check

Severity: Medium
OWASP API mapping: API1 Broken Object Level Authorization, API5 Broken Function Level Authorization
Status: Remediated

Evidence:
- `POST /api/catalog/:id/versions`, `POST /api/catalog/:id/versions/:version/current`, and `DELETE /api/catalog/:id/versions/:version` used `requireApiManager()` before route execution.
- The later write transactions changed `api_versions` and current API spec state without re-checking that the API was still owned by the caller's MDA.
- The catalog update route already used an in-write ownership guard, but catalog version publish/promote/delete did not.

Impact:
If API ownership changed between middleware authorization and the version write transaction, a stale MDA API owner could still publish, promote, or delete versions for an API they no longer owned. This is a TOCTOU authorization gap on catalog governance state.

Remediation:
- Catalog version publish, promote, and delete now lock and re-check the target API ownership inside the transaction.
- Stale ownership now returns the existing version stale-conflict path instead of applying the mutation.
- Covered by `backend/src/catalog-versions-security.test.ts`.

### 14. Account Signup And Approval Allow Role/Category Mismatch

Severity: Medium
OWASP API mapping: API5 Broken Function Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- Signup validation checked only that `requested_role` was one of the known roles.
- It did not verify that the requested role was valid for the selected account category, so a crafted request could submit `account_type=public_developer` with `requested_role=reviewer`.
- Admin approval also accepted a supplied approval role without checking it against the submitted verification account category, except for the special admin-promotion guard.

Impact:
A tampered signup or existing pending account could carry a higher-privilege requested role into the approval workflow. If approved without manually correcting the role, a public developer category could become a reviewer or another category/role mismatch, weakening the intended verification and least-privilege model.

Remediation:
- Added a central account-category to allowed-role policy.
- Signup now rejects requested roles that are not valid for the selected account type.
- Admin approval now rejects approval roles that are not valid for the submitted verification account category, including existing tampered pending accounts.
- Covered by `backend/src/account-role-security.test.ts`.

### 15. Production Data Encryption Key Accepts Weak Passphrases

Severity: Medium
OWASP API mapping: API8 Security Misconfiguration, API3 Broken Object Property Level Authorization
Status: Remediated

Evidence:
- `validateProductionSecurityEnv()` only required `GOVHUB_DATA_ENCRYPTION_KEY` to be present in production.
- `backend/src/crypto-at-rest.ts` hashes arbitrary non-hex/non-base64 input into an AES key, so a weak production value such as `password` would be accepted and used to protect profile data, MFA secrets, and one-time API key material.

Impact:
Production deployments could accidentally use low-entropy encryption passphrases for sensitive database fields. If database contents were exposed, weak passphrases would materially lower the effort needed to decrypt protected data.

Remediation:
- Production startup now rejects `GOVHUB_DATA_ENCRYPTION_KEY` unless it is a 32-byte key encoded as 64 hex characters or canonical standard base64.
- Non-production demo behavior can still use local defaults for development, but production must provide an explicit key.
- Covered by `backend/src/security-config.test.ts`.

### 16. Sandbox Audit Redaction Misses Common PII Aliases

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `backend/src/middleware/sandbox.ts` stores sandbox response bodies in audit-log details after calling `redactSandboxLogValue()`.
- The redactor covered identifiers, tokens, secrets, and key-like fields, but did not redact common PII aliases such as `fullName`, `givenName`, `surname`, `dateOfBirth`, `contactPhone`, `emailAddress`, or `residentialAddress`.
- OpenAPI-driven sandbox examples and caller request bodies can use these aliases.

Impact:
Sandbox console output and audit logs could persist personal names, dates of birth, contact details, or addresses in clear text even when identifier fields were redacted.

Remediation:
- Expanded sandbox audit redaction to cover common personal-data aliases, including names, dates of birth, contact phone/email fields, and address variants.
- Redaction is recursive, so nested arrays such as director lists are covered.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 17. OpenAPI URL Import Buffers Oversized Responses Before Enforcing Size Limit

Severity: Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `fetchSpecFromUrl()` checked `Content-Length` when present, but then called `response.text()` and only measured the body after the entire untrusted response had been buffered.
- A malicious or misconfigured allowed spec host could omit `Content-Length` and stream a body larger than `GOVHUB_SPEC_MAX_BYTES`, forcing the backend to allocate the full response before rejecting it.

Impact:
API catalog validation or registration workflows that import a spec URL could be used for avoidable memory pressure or denial-of-service against the backend process.

Remediation:
- OpenAPI URL imports now read response bodies from the stream and stop as soon as the configured byte limit is exceeded.
- Invalid `Content-Length` headers are rejected rather than ignored.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 18. Turnstile Siteverify Calls Can Hang Without An Upstream Timeout

Severity: Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `validateTurnstileToken()` called Cloudflare Siteverify through `fetch` without an `AbortSignal` or timeout.
- Login, signup, and app-load human verification all depend on this upstream call when Turnstile is configured.

Impact:
A stalled or degraded verification upstream could hold backend request handlers open until infrastructure-level timeouts, increasing worker/socket pressure on login and signup paths.

Remediation:
- Turnstile Siteverify calls now use an abortable timeout, defaulting to 5 seconds and capped at 30 seconds through `GOVHUB_TURNSTILE_TIMEOUT_MS`.
- Timeout and upstream failures continue to fail closed with `TURNSTILE_UNAVAILABLE`.
- Covered by `backend/src/turnstile-security.test.ts`.

### 19. Privileged API-Call Audit Filter Reuses Developer Scope

Severity: Low to Medium
OWASP API mapping: API5 Broken Function Level Authorization, API9 Improper Inventory Management
Status: Remediated

Evidence:
- `listAuditLogs()` used the same actor-scoped `apiCallLogWhereClause()` whenever `scope=api-calls` was requested.
- The `/api/access/audit-logs?scope=api-calls` route is available to admins, reviewers, and developers. Developers should remain scoped to their own API-call logs, but reviewers and admins need cross-consumer API-call visibility for oversight.

Impact:
Admin/reviewer audit dashboards could show an incomplete API-call audit trail when filtered to sandbox API calls, weakening incident review and compliance monitoring.

Remediation:
- Developer audit-log reads remain scoped to the developer user/MDA.
- Admin/reviewer `scope=api-calls` now filters only by `SANDBOX_CALL%` event type and does not reuse developer actor scoping.
- Covered by `backend/src/access-control-security.test.ts`.

### 20. Protected Documentation And OpenAPI Responses Lack No-Store Cache Controls

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `securityHeadersForPath()` applied `Cache-Control: no-store` to `/api/auth`, `/api/admin`, and `/api/access`, but not `/api/docs`, `/api/catalog`, or `/openapi` routes.
- Those docs/spec endpoints can return authenticated or restricted OpenAPI metadata depending on the caller and API visibility configuration.

Impact:
Authenticated or restricted documentation responses could be cached by browsers or intermediate infrastructure more broadly than intended, increasing the chance that sensitive API metadata remains available after access changes or on shared devices.

Remediation:
- No-store cache headers now cover `/api/docs`, `/api/catalog`, and `/openapi` responses in the centralized security header middleware.
- Covered by `backend/src/security-headers.test.ts`.

### 21. Verification Document Upload Accepts Client-Supplied Storage References

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `POST /api/auth/account/documents` destructured `storage_ref` from the client JSON body and passed it into `validateVerificationDocumentInput()`.
- `validateVerificationDocumentInput()` allowed several storage-reference prefixes and returned the supplied `storage_ref` in the validated value.
- `upsertVerificationDocument()` persisted `input.storage_ref` when present, falling back to a server-generated `metadata://{userId}/{file_name}` reference only when the client omitted it.

Impact:
A crafted document upload request could bind attacker-chosen internal storage metadata to the user's verification document record. The value was no longer exposed in account snapshots, but accepting it still weakened the server-side ownership boundary for future review, retrieval, or storage-worker flows that might trust the stored locator.

Remediation:
- Document upload validation now returns only server-approved writable fields: document type, canonical label, file name, and MIME type.
- The document route no longer passes client `storage_ref` into validation or persistence, so storage metadata is generated server-side.
- Covered by `backend/src/account-verification-security.test.ts`.

### 22. Authenticated MFA Mutation Attempts Are Not Rate-Limited

Severity: Medium
OWASP API mapping: API2 Broken Authentication, API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- Login MFA verification consumed the login rate-limit bucket, but `/api/auth/mfa/setup`, `/api/auth/mfa/enable`, and `/api/auth/mfa/disable` did not consume any rate-limit bucket.
- `/api/auth/mfa/disable` required the account password and current TOTP code, but an attacker with a stolen authenticated session and password could repeatedly guess six-digit TOTP codes without a server-side attempt cap.

Impact:
Authenticated MFA mutation endpoints allowed avoidable brute-force pressure against password-confirmation and TOTP checks. The highest-risk path was disabling MFA after session and password compromise.

Remediation:
- Added a per-user MFA attempt rate limit for setup, enable, and disable flows, defaulting to 5 attempts per 10-minute window through `GOVHUB_MFA_RATE_LIMIT`.
- Successful MFA setup, enable, or disable clears the relevant MFA attempt bucket.
- Covered by `backend/src/auth-mfa-rate-limit-security.test.ts`.

### 23. Account Suspension Leaves Existing Sessions Active

Severity: Low to Medium
OWASP API mapping: API2 Broken Authentication, API5 Broken Function Level Authorization
Status: Remediated

Evidence:
- `POST /api/admin/users/:id/suspend` set the target user status to `SUSPENDED` and revoked active API keys.
- The delete-account path explicitly revoked and deleted sessions, but the suspension path did not update `sessions.revoked_at` for the target user.
- Runtime auth checks denied suspended users, but the session token itself stayed active in the session table until expiration.

Impact:
Suspended users were blocked by current status checks, but their existing session tokens remained live database credentials until TTL expiry. If account status was restored, changed incorrectly, or a future endpoint trusted session existence before status checks, the old token could regain access without reauthentication. Suspension should be an immediate credential invalidation event.

Remediation:
- Account suspension now revokes active sessions for the target user inside the same admin mutation transaction.
- Covered by `backend/src/auth-session-security.test.ts`.

### 24. Signup Passwords Are Hashed Without A Maximum Length

Severity: Low to Medium
OWASP API mapping: API2 Broken Authentication, API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- Login validation rejected passwords longer than 1024 characters before credential verification.
- Signup validation enforced password complexity and minimum length, but did not enforce a maximum before passing `req.body.password` into `hashPassword()`.
- `hashPassword()` uses `crypto.scryptSync`, so oversized signup payloads could force avoidable CPU and memory work before the account is created.

Impact:
A client could submit a syntactically valid, very large signup password up to the JSON body limit and make the server perform unnecessary password hashing work. This is bounded by the request body cap, but signup is an unauthenticated, expensive authentication-adjacent flow and should reject oversized secrets before hashing.

Remediation:
- Signup and login now share the same 1024-character password input ceiling.
- Oversized signup passwords are rejected with HTTP 400 before user creation or password hashing.
- Covered by `backend/src/auth-signup-security.test.ts`.

### 25. MFA Password Confirmations Are Verified Without A Maximum Length

Severity: Low to Medium
OWASP API mapping: API2 Broken Authentication, API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `/api/auth/mfa/setup` and `/api/auth/mfa/disable` required password confirmation, but accepted any string length before calling `verifyPassword()`.
- `verifyPassword()` uses `crypto.scryptSync`, so oversized authenticated requests could force avoidable CPU and memory work.
- The MFA attempt limiter reduced brute-force volume, but each oversized attempt still reached rate-limit persistence and password verification.

Impact:
An attacker with a stolen authenticated session could submit oversized password-confirmation payloads to MFA mutation endpoints. The request body limit constrained maximum size, but expensive credential checks should still reject invalidly large inputs before rate-limit writes or scrypt verification.

Remediation:
- MFA setup and disable password confirmations now share the 1024-character password input ceiling.
- Oversized MFA confirmation passwords are rejected with HTTP 400 before rate-limit writes, password verification, or MFA state mutation.
- Covered by `backend/src/auth-password-confirmation-security.test.ts`.

### 26. Frontend Document Upload Still Over-Posts Storage References

Severity: Low
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- The backend document upload route was hardened to ignore client-supplied `storage_ref` values.
- The account settings frontend still fabricated `s3://govhub-vault/docs/...` references in `DocumentUploader` and posted `storage_ref` in `AccountSettingsPage`.
- This kept internal storage locator semantics in client code even though the server no longer trusted them.

Impact:
The server-side trust boundary was already fixed, but the frontend continued to disclose and transmit an internal storage-reference pattern. Keeping that over-posting path increases the chance future server changes, logs, or proxies accidentally preserve client-chosen storage locators.

Remediation:
- Document upload UI callbacks now pass only public metadata: document type, label, file name, and MIME type.
- The frontend no longer fabricates `s3://` document locator values or posts `storage_ref` to `/api/auth/account/documents`.
- Covered by `frontend/src/pages/account-settings/document-storage-security.test.ts`.

### 27. Admin User Listing Is Unbounded And Accepts Arbitrary Status Filters

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `GET /api/admin/users` selected all users ordered by creation time when no status filter was provided.
- The status-filtered path also lacked `LIMIT/OFFSET`, and `status` accepted arbitrary strings rather than the known account-review states.
- Each returned user triggered account snapshot hydration, so an unbounded list could amplify database work.

Impact:
An administrator session, compromised administrator browser, or automated admin client could request a full user listing and force avoidable database and encryption/decryption work across every account snapshot. Arbitrary status values were parameterized and not SQL injection, but still represented missing boundary validation on an administrative query surface.

Remediation:
- Admin user listing now validates `status` against `PENDING_REVIEW`, `APPROVED`, `REJECTED`, and `SUSPENDED`.
- The route always applies bounded pagination before account snapshot hydration, defaults to 100 rows, caps oversized limits at 100 rows, normalizes negative offsets to zero, and caps oversized offsets at 10000.
- The response includes the effective `limit` and `offset` values for client pagination.
- Covered by `backend/src/admin-users-list-security.test.ts`.

### 28. Access Request Listing Is Unbounded

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API5 Broken Function Level Authorization
Status: Remediated

Evidence:
- `GET /api/access` called `buildAccessRequestList()` for admins, reviewers, API owners, and developers.
- `buildAccessRequestList()` joined `access_requests`, `apis`, `mdas`, and `users`, then returned the full ordered result set without `LIMIT/OFFSET`.
- Privileged users such as admins and reviewers had the largest blast radius because they could request all access requests in one response.

Impact:
A high-privilege session, compromised admin/reviewer browser, or automated client could force avoidable database work and response payload growth across the access governance list. Developer and API-owner scopes were narrower, but still unbounded within their assigned user or MDA scope.

Remediation:
- Access request listing now applies bounded pagination in `buildAccessRequestList()`.
- The route defaults to a 100-row page, caps oversized limits at 100 rows, normalizes negative offsets to zero, and caps oversized offsets at 10000.
- The existing array response shape is preserved for compatibility.
- Covered by `backend/src/access-control-security.test.ts`.

### 29. Public Catalog And Documentation Listing Is Unbounded And Performs Developer N+1 Access Checks

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API5 Broken Function Level Authorization
Status: Remediated

Evidence:
- `GET /api/catalog` and `GET /api/docs` both called `listVisibleDocsApis()`.
- `listVisibleDocsApis()` loaded every API row before filtering by effective documentation visibility.
- For approved developer accounts, each restricted API triggered a separate approved-access lookup, creating an N+1 query pattern on optional-auth public routes.

Impact:
Unauthenticated clients could request the full public catalog without pagination, and approved developer sessions could amplify database work by forcing one access-request check per restricted API. This was not an authorization bypass, but it made catalog/docs discovery work scale with total catalog size rather than a bounded page.

Remediation:
- Documentation visibility filtering now happens in SQL before rows are returned.
- Developer restricted-doc access uses a single `EXISTS` predicate instead of per-API lookups.
- Catalog/docs listing defaults to a 100-row page, caps oversized limits at 100 rows, normalizes negative offsets to zero, and caps oversized offsets at 10000.
- The existing array response shape is preserved for compatibility.
- Covered by `backend/src/docs-access-security.test.ts`.

### 30. Access Matrix Listing Is Unbounded

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `GET /api/access/matrix` returned every active approved access-request row to admins and reviewers.
- The query filtered active keys, but it did not apply `LIMIT/OFFSET` or a deterministic order.

Impact:
An admin/reviewer session, compromised privileged browser, or automated client could force a full active-access matrix response and database scan. This dashboard endpoint is privileged, but it can grow with every approved API/consumer pairing and should be bounded like the related access list and audit list endpoints.

Remediation:
- Access matrix reads now use `buildAccessMatrix()` with bounded pagination.
- The route defaults to a 100-row page, caps oversized limits at 100 rows, normalizes negative offsets to zero, caps oversized offsets at 10000, and orders rows deterministically.
- The existing array response shape is preserved for compatibility.
- Covered by `backend/src/access-control-security.test.ts`.

### 31. Catalog Version Listing Is Unbounded

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `GET /api/catalog/:id/versions` enforced documentation visibility before listing version history.
- After authorization, it returned every stored `api_versions` row for the API without `LIMIT/OFFSET`.
- Public API docs made this reachable without authentication for public catalogs, while authenticated/restricted docs exposed the same scaling issue to authorized sessions.

Impact:
A client could force unbounded version-history responses for any API whose docs it was allowed to view. This did not bypass documentation authorization, but it allowed avoidable database work and response growth on a public-facing catalog route.

Remediation:
- Catalog version listing now applies bounded pagination before reading version history.
- The route defaults to a 100-row page, caps oversized limits at 100 rows, normalizes negative offsets to zero, and caps oversized offsets at 10000.
- The existing array response shape is preserved for compatibility.
- Covered by `backend/src/catalog-versions-security.test.ts`.

### 32. Sandbox Dynamic Path Resolution Scans All Sandbox APIs Before API-Key Validation

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `sandboxMiddleware()` resolved the target API id before rejecting missing or malformed sandbox API keys.
- For any `/api/v1/...` path that did not match the static sandbox mappings, path resolution queried every sandbox-enabled API with `SELECT id, sandbox_available FROM apis WHERE sandbox_available = TRUE`.
- Unauthenticated requests to arbitrary unknown `/api/v1/...` paths could therefore force avoidable catalog scans before authentication failed.

Impact:
An unauthenticated client could repeatedly hit non-default sandbox paths and make each request perform work proportional to the number of sandbox-enabled APIs. The existing invalid-key rate limit still applied after path resolution, but the expensive lookup happened first.

Remediation:
- Default sandbox routes still resolve through the static mapping table without a database query.
- Dynamic registered sandbox routes now parse `/api/v1/sandbox/:apiId/...` and verify only that API id with a parameterized lookup.
- Unknown non-dynamic sandbox paths no longer query the catalog before API-key validation.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 33. Catalog Detail Endpoint Over-Exposes Stored OpenAPI Spec Text

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `GET /api/catalog/:id` authorized documentation visibility and then returned `SELECT * FROM apis`.
- The `apis` table stores `openapi_spec_text`, which can be large and is already served through dedicated `/api/catalog/:id/spec`, `/api/docs/:id/spec`, and `/openapi/:filename` paths.
- `SELECT *` also risked exposing future internal catalog columns unintentionally.

Impact:
Any caller allowed to view an API catalog detail record could receive stored OpenAPI source text and any newly added table columns through a metadata endpoint. This increased response size and blurred the boundary between public metadata and stored specification content.

Remediation:
- Catalog detail now uses an explicit allowlist of metadata fields.
- Stored `openapi_spec_text` remains available only through the dedicated spec-serving paths after the same documentation visibility check.
- Covered by `backend/src/catalog-detail-security.test.ts`.

### 34. Account Approval MDA Requirement Uses Stale Signup Account Type

Severity: Medium
OWASP API mapping: API5 Broken Function Level Authorization, business logic workflow bypass
Status: Remediated

Evidence:
- Admin approval checked role/category compatibility against `snapshot.profile.account_category`, which is the verified account category submitted for review.
- The same route then decided whether `mda_id` was required with `approvalRequiresMda(existing.account_type, role)`, where `existing.account_type` is the original signup category.
- Users can update their verification profile category before submission, so a submitted government-employee reviewer profile could be approved without an MDA when the original signup category was `public_developer`.

Impact:
Government-scoped reviewer accounts could be approved without an assigned MDA when profile category and signup category diverged. That creates an inconsistent privileged account state and weakens downstream audit, dashboard, and governance assumptions that government/MDA operator identities carry an MDA assignment.

Remediation:
- Admin approval now computes both role compatibility and MDA requirement from the normalized verified profile account category.
- The dashboard approval helper now uses the submitted profile account category when choosing whether to send an MDA.
- Covered by `backend/src/account-role-security.test.ts` and `frontend/src/dashboard/account-approval-security.test.ts`.

### 35. Built-In Sandbox Routes Ignore Disabled Sandbox Availability

Severity: Medium
OWASP API mapping: API5 Broken Function Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- Dynamic `/api/v1/sandbox/:apiId/...` path resolution checked `apis.sandbox_available = TRUE` before accepting an API id.
- Built-in sandbox paths such as `/api/v1/identity/...` resolved through hardcoded default mappings and returned the API id without checking the current catalog row.
- Disabling `sandbox_available` for one of the built-in demo/catalog APIs therefore did not stop runtime sandbox access when a valid API key existed for that API.

Impact:
Catalog administrators could disable sandbox availability for a built-in API but the runtime sandbox middleware would still route authorized calls to that API. This made the catalog control inconsistent and could leave sandbox endpoints exposed after an operator believed they had been disabled.

Remediation:
- Static built-in sandbox mappings now perform the same one-row `SELECT id FROM apis WHERE id = $1 AND sandbox_available = TRUE` check used by dynamic sandbox routes.
- If the mapped API is missing or no longer sandbox-enabled, the middleware treats the request as an unauthorized endpoint instead of running the sandbox handler.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 36. Encrypted-Field Helper Trusts Client-Supplied Ciphertext Prefixes

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration, business logic data integrity
Status: Remediated

Evidence:
- `encryptAtRest()` returned any string beginning with `enc:v1:` unchanged as already-encrypted data.
- Account profile and verification-document write paths pass user-controlled fields through `encryptAtRest()`.
- Later account snapshot and admin-review reads call `decryptAtRest()` for encrypted profile and document fields, so malformed encrypted-looking values could throw during review/snapshot hydration.

Impact:
Approved or pending users could poison their own profile or document metadata with malformed encrypted-looking strings such as `enc:v1:not-a-valid-envelope`. The value would be stored unchanged, and later account snapshot or admin review paths could fail until the stored data was repaired.

Remediation:
- `encryptAtRest()` now preserves only encrypted values that can be decrypted with the active key.
- Undecryptable encrypted-looking values are encrypted as plaintext before storage, which also lets existing startup re-encryption/migration paths repair malformed prefix values.
- Covered by `backend/src/crypto-at-rest-security.test.ts`.

### 37. Turnstile Verification Can Be Used For Upstream Request Amplification

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `/api/auth/human-verification`, `/api/auth/signup`, and `/api/auth/login` called `validateTurnstileToken()` before any local per-IP rate gate when a Turnstile secret was configured.
- `validateTurnstileToken()` performs a server-side request to Cloudflare Siteverify for each non-empty token.
- The login-specific rate limit was applied only after Turnstile verification, so invalid or repeated Turnstile tokens could spend upstream verification work before the login limiter ran.

Impact:
An unauthenticated client could repeatedly trigger backend-to-Cloudflare Siteverify calls, consuming server connection slots and upstream verification quota. The timeout limited each call duration, but it did not bound request volume.

Remediation:
- Turnstile-backed human-verification actions now consume a local per-IP rate-limit bucket before calling the upstream verifier.
- The limit defaults to 60 attempts per 10 minutes and can be tuned with `GOVHUB_TURNSTILE_RATE_LIMIT`.
- Excess attempts return `HUMAN_VERIFICATION_RATE_LIMITED` without calling Cloudflare.
- Covered by `backend/src/auth-turnstile-rate-limit-security.test.ts`.

### 38. Recursive OpenAPI Schemas Can Crash Frontend Example Rendering

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API3 Broken Object Property Level Authorization
Status: Remediated

Evidence:
- `frontend/src/pages/api-docs/api-docs-openapi.tsx` generated request, response, and code-sample examples by recursively following schema `$ref`, object properties, and array items without cycle tracking.
- `frontend/src/pages/catalog/api-detail-helpers.tsx` used similar recursion for catalog request/response examples.
- OpenAPI schemas commonly support self-references, for example tree or graph node models. A malicious or accidental self-referential schema could therefore overflow the browser call stack or freeze docs/catalog views for users allowed to view that API.

Impact:
An API owner or administrator could publish a valid-looking recursive OpenAPI schema that makes the docs or catalog detail page fail for administrators, reviewers, API owners, developers, or approved consumers who open it. This is a frontend availability risk on a trusted but user-supplied specification surface.

Remediation:
- Added shared `frontend/src/lib/openapi-examples.ts` example generation with JSON-pointer `$ref` resolution, visited-reference tracking, and a maximum traversal depth.
- Docs and catalog example generation now use the bounded helper and omit recursive branches instead of following them indefinitely.
- Covered by `frontend/src/pages/openapi-example-security.test.ts`.

### 39. Duplicate Session Cookies Are Resolved Ambiguously

Severity: Low to Medium
OWASP API mapping: API2 Broken Authentication, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `getBearerToken()` parsed the `Cookie` header with `Object.fromEntries()`.
- If a request contained more than one `govhub_session` cookie, the last duplicate silently won.

Impact:
Duplicate session-cookie names can arise from path/domain confusion, stale cookies, or cookie-tossing scenarios. Silently choosing one duplicate makes authentication dependent on header ordering instead of rejecting the ambiguous request, which weakens session-boundary predictability.

Remediation:
- Session cookie parsing now rejects requests with more than one `govhub_session` cookie.
- Bearer tokens and single well-formed session cookies continue to work normally.
- Covered by `backend/src/auth-session-security.test.ts`.

### 40. Login-Time MFA Code Guesses Are Not Rate-Limited Per User

Severity: Medium
OWASP API mapping: API2 Broken Authentication, API4 Unrestricted Resource Consumption
Status: Remediated

Evidence:
- `/api/auth/login` applied a login rate-limit bucket keyed by `IP:email`.
- After a correct password for an MFA-enabled account, invalid TOTP guesses were checked directly without consuming the existing per-user MFA attempt limiter.
- A distributed attacker with a known password could rotate source IPs and continue TOTP guessing against the same account without hitting an account-level MFA bucket.

Impact:
The password still had to be known, and the TOTP space is time-limited, but relying only on IP+email throttling leaves login-time MFA weaker than the authenticated setup/enable/disable MFA flows. Per-user throttling is the correct boundary for protecting a second factor on a specific account.

Remediation:
- The login MFA branch now consumes the same per-user MFA limiter before validating a submitted TOTP code.
- Successful TOTP validation clears the login MFA attempt bucket.
- Covered by `backend/src/auth-mfa-rate-limit-security.test.ts`.

### 41. Inline OpenAPI Specs Bypass The Configured Spec Size Limit

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- URL-based OpenAPI imports enforced `GOVHUB_SPEC_MAX_BYTES`.
- Inline `openapi_spec` catalog registration/patch input and `/api/catalog/validate-spec` `specText` were accepted directly and only relied on the broader Express JSON body limit.

Impact:
Operators can configure a smaller spec-specific byte ceiling for remote imports, but inline specs ignored that ceiling. If the global JSON limit is raised for unrelated API needs, a privileged API owner could submit oversized specs that consume parsing/storage resources beyond the intended OpenAPI ingestion budget.

Remediation:
- Inline OpenAPI spec input now checks `GOVHUB_SPEC_MAX_BYTES` before validation, parsing, catalog registration, or catalog patching.
- `/api/catalog/validate-spec` applies the same inline limit to `specText`.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 42. Public User Serialization Exposes MFA Enablement Timestamp

Severity: Low
OWASP API mapping: API3 Broken Object Property Level Authorization, API2 Broken Authentication
Status: Remediated

Evidence:
- `sanitizeUser()` omitted `password_hash` and `mfa_secret_encrypted`, but still returned `mfa_enabled_at`.
- Auth, account, and admin user responses therefore exposed the exact timestamp when an account enabled MFA.

Impact:
The timestamp is not a credential, but it is account-security metadata that clients do not need. Exposing it increases unnecessary information disclosure about security posture and account lifecycle timing. The frontend only requires a boolean `mfa_enabled` value.

Remediation:
- `sanitizeUser()` now omits `mfa_enabled_at` and returns only `mfa_enabled`.
- The `PublicUser` type now excludes the timestamp field.
- Covered by `backend/src/auth-session-security.test.ts`.

### 43. OpenAPI Path Keys Can Normalize Into External Sandbox Request URLs

Severity: Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `validateOpenApiSpec()` accepted any `paths` object key as long as the path item was an object.
- Frontend docs/catalog helpers later build sample and sandbox URLs from those path keys with `new URL(...)`.
- Path keys such as `//attacker.example/collect` or `/\attacker.example/collect` can be interpreted by browser URL parsing as external authority URLs when combined with an empty or root server base path.

Impact:
A malicious or compromised OpenAPI spec could present a sandbox request target outside the GovHub API origin. If a user pasted a sandbox API key or enabled custom request headers and sent the request, those user-supplied headers could be transmitted to an attacker-controlled host instead of the intended sandbox route.

Remediation:
- OpenAPI validation now requires each path key to start with exactly one `/`.
- Path keys containing backslashes or control characters are rejected before catalog registration, patching, validation, or version metadata parsing.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 44. OpenAPI Server URLs Can Normalize Into External Sandbox Request URLs

Severity: Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `validateOpenApiSpec()` did not validate optional `servers` declarations.
- Frontend docs/catalog helpers use `spec.servers?.[0]?.url` when constructing sample and sandbox URLs.
- Protocol-relative server URLs such as `//attacker.example` or backslash-containing relative URLs such as `/\attacker.example` can be interpreted as external authority URLs by browser URL parsing.

Impact:
A malicious OpenAPI spec could use a hostile `servers[0].url` value with otherwise normal path keys to show or send sandbox requests to an attacker-controlled origin. If a user pasted an API key or enabled custom headers, those user-supplied headers could leave the GovHub API origin.

Remediation:
- OpenAPI validation now requires `servers`, when present, to be an array of objects.
- Server URLs that are protocol-relative or contain backslashes/control characters are rejected before catalog registration, patching, validation, or version metadata parsing.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 45. Cyclic YAML Aliases Can Break JSON OpenAPI Spec Responses

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `validateOpenApiSpec()` parsed YAML but did not reject YAML anchors/aliases that create circular JavaScript object graphs.
- Docs/catalog spec endpoints parse stored YAML and return it via `res.json(...)`.
- A cyclic object graph throws during JSON serialization, causing the spec endpoint to fail for every user allowed to view that API.

Impact:
An API owner or administrator could publish a YAML OpenAPI document that validates and stores successfully but later causes documentation/spec JSON endpoints to return 500 errors. That creates an availability issue on a user-supplied specification surface.

Remediation:
- OpenAPI validation now walks the parsed object graph and rejects circular YAML aliases before metadata extraction or storage.
- Shared non-cyclic aliases are still allowed; only active recursion cycles are rejected.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 46. Stored OpenAPI JSON Routes Bypass The Validated Parser

Severity: Low to Medium
OWASP API mapping: API4 Unrestricted Resource Consumption, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `parseStoredOpenApiSpec()` used raw `yaml.load()`.
- `/api/catalog/:id/spec` and `/api/docs/:id/spec` also parsed stored spec text directly with `yaml.load()`.
- That bypassed the new OpenAPI validation path for existing database rows or specs accepted before the validator was hardened.

Impact:
Legacy stored specs containing cyclic YAML aliases, unsafe path keys, or unsafe server URLs could still reach JSON docs/catalog responses or sandbox OpenAPI fallback logic even after future ingestion was hardened. Cyclic aliases can break JSON serialization; unsafe URL fields can reappear in clients that render stored specs.

Remediation:
- `parseStoredOpenApiSpec()` now returns `validateOpenApiSpec(specText).parsed`.
- Catalog and docs JSON spec routes now use `parseStoredOpenApiSpec()` instead of raw YAML parsing.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 47. Sandbox Response Console Echoes Credentials In Displayed Headers

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization, API2 Broken Authentication
Status: Remediated

Evidence:
- `SandboxTryItConsole` copied outbound sandbox request headers into `sentHeaders`.
- Successful responses stored `requestHeaders: sentHeaders`.
- The response console also stored `headers: headersObj` from response headers.
- The response console rendered request and response headers directly, which could display pasted `X-GovHub-API-Key`, custom `Authorization`, `Cookie`, password, credential, token, secret, or API-key-like headers.

Impact:
The key was not persisted to browser storage, but the UI could expose full credentials in the visible response console. Response headers from same-origin sandbox handlers or future integrations could create the same exposure. This increases risk from screen sharing, screenshots, shoulder-surfing, support captures, or accidental copy/paste of response output.

Remediation:
- Added display-only request and response header redaction for sensitive header names, including common password, credential, token, secret, and API-key variants.
- The actual outbound `fetch` headers are unchanged; only the stored/rendered response-console copy is redacted.
- Covered by `frontend/src/dashboard/api-key-storage.test.ts`.

### 48. Missing Sandbox API Keys Trigger Catalog Lookups Before Invalid-Key Throttling

Severity: Low
OWASP API mapping: API4 Unrestricted Resource Consumption, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `sandboxMiddleware()` parsed `X-GovHub-API-Key` but resolved the sandbox API id with `getApiIdFromPath()` before handling missing or malformed API-key headers.
- For known built-in paths and dynamic `/api/v1/sandbox/:apiId/...` paths, that performed a catalog availability lookup before the invalid-key rate-limit bucket was consumed.

Impact:
Unauthenticated clients could send missing-key requests to known sandbox paths and force avoidable pre-auth catalog reads. The previous full-catalog scan issue was already fixed, but this left a lower-cost amplification path on every missing or malformed API-key request.

Remediation:
- Missing or malformed sandbox API-key headers now consume the invalid-key rate-limit bucket and return before catalog API-id resolution.
- Valid single-value API-key requests still resolve and enforce `sandbox_available` normally.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 49. Admins Could Consume One-Time API Key Reveals For Legacy MDA Requests

Severity: Medium
OWASP API mapping: API5 Broken Function Level Authorization, API3 Broken Object Property Level Authorization
Status: Remediated

Evidence:
- `POST /api/access/:id/reveal-key` allowed both `developer` and `admin` roles.
- The atomic reveal query permits a claim when `consumer_user_id` matches the caller, or when `consumer_user_id IS NULL` and the caller's `mda_id` matches `consumer_mda_id`.
- For legacy MDA-level approved requests with no `consumer_user_id`, an admin assigned to the same consumer MDA could reveal and atomically clear the encrypted one-time API key.

Impact:
A non-developer administrative user could consume a consumer's one-time sandbox API key reveal when their MDA matched a legacy request. That exposes a full credential to the wrong role and also prevents the intended developer from using the one-time reveal afterward.

Remediation:
- The reveal route is now restricted to `developer` users before the atomic claim/clear query can run.
- The dashboard auto-reveal path now attempts one-time key claims only for developer sessions.
- Covered by `backend/src/access-control-security.test.ts` and `frontend/src/dashboard/api-key-storage.test.ts`.

### 50. Admin Access Requests Could Enter An Unclaimable One-Time Key Lifecycle

Severity: Low to Medium
OWASP API mapping: API5 Broken Function Level Authorization, API6 Unrestricted Access to Sensitive Business Flows
Status: Remediated

Evidence:
- `POST /api/access` accepted both `developer` and `admin` roles even though the route models consumer access request submission.
- Admin-submitted MDA requests stored the admin's user id as `consumer_user_id`.
- After one-time key reveal was correctly narrowed to developers, an approved admin-submitted request could hold active key metadata that the admin could not reveal and a same-MDA developer could not claim because `consumer_user_id` was non-null.

Impact:
An admin could intentionally or accidentally create pending or approved access records that block the real consumer MDA from submitting a usable request for the same API. That creates a governance workflow denial-of-service and leaves unretrievable key material in the lifecycle.

Remediation:
- Access request submission is now restricted to developer users before the request validation and insert path runs.
- The catalog request-access button is disabled for non-developer roles so the frontend does not send requests the backend will reject.
- Covered by `backend/src/access-control-security.test.ts` and `frontend/src/dashboard/api-key-storage.test.ts`.

### 51. Local Postgres Helpers Exposed The Dev Database On All Interfaces

Severity: Low
OWASP API mapping: API8 Security Misconfiguration, API3 Broken Object Property Level Authorization
Status: Remediated

Evidence:
- `docker-compose.yml` published the local Postgres service as `5432:5432`.
- `scripts/local-postgres.mjs` used the same Docker `-p 5432:5432` binding.
- The local helper also has a committed development password default intended for convenience.

Impact:
On typical Docker setups, `5432:5432` binds the database port on all host interfaces. On a developer workstation or shared network, that can expose the local GovHub database to other machines using a committed development credential. This is a local-development exposure, not a production runtime flaw.

Remediation:
- Local Docker Compose now binds Postgres to `127.0.0.1:${GOVHUB_POSTGRES_PORT:-5432}:5432`.
- The local Postgres helper now binds Docker `run` to `127.0.0.1:${GOVHUB_POSTGRES_PORT || '5432'}:5432`.
- Covered by `backend/src/local-postgres-security.test.ts`.

### 52. Local Production Environment File Contains Live-Looking Secrets

Severity: Medium
OWASP API mapping: API8 Security Misconfiguration, API3 Broken Object Property Level Authorization
Status: Partially remediated in repository controls; operational rotation required

Evidence:
- A local ignored `.env.production.local` file exists in the project root and contains production-style database connection strings, database passwords, and Vercel token material.
- The file is not tracked by git in this worktree, but the project-local `.gitignore` only covered `.env`, `backend/.env`, and `frontend/.env`; it relied on parent repository ignore rules to ignore `.env.production.local`.

Impact:
Even when not committed, live production credentials in a local project directory increase exposure through accidental archive sharing, copied project folders, editor sync, terminal history, support bundles, backups, or future repository restructuring. If any of the observed values were ever shared or committed elsewhere, ignore rules cannot revoke them.

Remediation:
- Project-local `.gitignore` now ignores `.env*`, `backend/.env*`, and `frontend/.env*`.
- `.env.example`, `backend/.env.example`, and `frontend/.env.example` remain explicitly trackable.
- Covered by `backend/src/local-env-security.test.ts`.

Required operational action:
- Rotate the database credentials and Vercel token material that were present in the local production env file, then replace the local file with freshly issued secrets from the deployment provider.

### 53. Malformed Sandbox API Keys Triggered Pre-Throttle Database Lookups

Severity: Low
OWASP API mapping: API4 Unrestricted Resource Consumption, API8 Security Misconfiguration
Status: Remediated

Evidence:
- `parseSandboxApiKeyHeader()` accepted any non-empty string as a candidate sandbox API key.
- For obvious malformed values, `sandboxMiddleware()` still resolved catalog API availability and queried `access_requests` by hash before consuming the invalid-key rate-limit bucket and rejecting the request.

Impact:
Unauthenticated clients could send cheap malformed key values to force avoidable catalog and access-request database reads on sandbox routes. This did not grant access, but it created an unnecessary pre-throttle resource-consumption path.

Remediation:
- Sandbox API keys are now validated at the header boundary as the generated `ghk_` plus 64 lowercase hex characters format before any catalog or access-request lookup.
- Malformed non-empty sandbox API-key headers now consume the invalid-key quota and return `INVALID_API_KEY` with HTTP 401 before database lookups.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 54. Frontend API Credential Wrapper Used Prefix-Based Origin Matching

Severity: Low
OWASP API mapping: API8 Security Misconfiguration, API2 Broken Authentication
Status: Remediated

Evidence:
- `UserProvider` globally wrapped `window.fetch` and set `credentials: 'include'` when the target URL string started with `/api` or `API_BASE`.
- String prefix checks could classify lookalike origins or paths such as `https://api.govhub.example.evil.test/...` or `/backend.evil/...` as API requests when they shared the configured prefix text.

Impact:
The browser would not send GovHub host-only cookies to an unrelated hostname, but the wrapper still made the credential boundary depend on string prefixes instead of parsed URL origin/path identity. That creates avoidable risk if future cookies, subdomain deployments, or user-controlled fetch targets are introduced.

Remediation:
- Added `frontend/src/lib/api-credentials.ts` to parse request and API base URLs before deciding whether credentials should be included.
- Credentialed fetches are now limited to relative `/api` paths or the exact configured API origin plus matching base path.
- Covered by `frontend/src/context/fetch-credentials-security.test.ts`.

### 55. Persistent Local Notifications Stored Free-Form Account Review Text

Severity: Low
OWASP API mapping: API3 Broken Object Property Level Authorization, API8 Security Misconfiguration
Status: Remediated

Evidence:
- Account rejection and more-information workflows appended administrator-entered `reason` or `notes` into local notification messages.
- Notifications are persisted in browser `localStorage` under `govhub_notifications:<userId>`, including when an administrator creates a notification for a reviewed user from the admin browser.

Impact:
Free-form review notes can contain sensitive account, document, or identity-review context. Persisting that text in browser storage expands exposure on shared devices and creates an unnecessary XSS/local forensic disclosure target. The authoritative review text already belongs in backend account-review fields.

Remediation:
- Rejection and more-information notifications now use generic local messages directing the user to account settings.
- The backend still receives and stores the review reason/notes for the account workflow.
- Covered by `frontend/src/dashboard/account-approval-security.test.ts`.

### 56. Cookie-Authenticated Mutations Accepted Missing Origin Headers

Severity: Medium
OWASP API mapping: API2 Broken Authentication, API8 Security Misconfiguration
Status: Remediated

Evidence:
- The API uses an `httpOnly` session cookie for browser authentication and CORS rejects untrusted explicit origins.
- Requests without an `Origin` header were allowed globally so non-browser clients could call the API.
- Unsafe methods carrying `govhub_session` did not have an additional Origin requirement before reaching state-changing routes such as logout, access-key operations, or admin account mutations.

Impact:
SameSite cookies and CORS substantially reduce browser CSRF exposure, but accepting no-Origin, cookie-authenticated unsafe requests leaves a weaker boundary for legacy/browser edge cases and cross-context request gadgets. State-changing cookie requests should prove they came from a configured frontend origin.

Remediation:
- Added `backend/src/csrf.ts` with a cookie-aware Origin guard for unsafe methods.
- Requests using no session cookie, safe methods, and bearer-token/non-browser flows remain available.
- Unsafe requests carrying `govhub_session` must include an Origin exactly present in `GOVHUB_ALLOWED_ORIGINS`.
- Covered by `backend/src/auth-session-security.test.ts`.

### 57. OpenAPI URL Import DNS Preflight Could Be Bypassed By Re-Resolution

Severity: Medium
OWASP API mapping: API7 Server-Side Request Forgery, API10 Unsafe Consumption of APIs
Status: Remediated

Evidence:
- `fetchSpecFromUrl()` resolved the submitted hostname and rejected private, local, documentation, multicast, and reserved IP ranges.
- After that preflight, it called `fetch(parsed.toString())`, allowing the HTTP client to resolve the hostname again during the actual outbound request.
- A DNS-rebinding hostname could return a public address for the preflight and a private or link-local address for the subsequent request.

Impact:
An allowed spec import host, or a non-production environment that permits unlisted hosts, could potentially bypass the intended SSRF IP-range checks and make the server request internal services or cloud metadata endpoints.

Remediation:
- Remote spec fetching now uses `http`/`https` with a custom lookup function pinned to the DNS address already vetted by the SSRF preflight.
- The request still uses the original parsed URL hostname for normal HTTP host handling and HTTPS certificate validation, but cannot perform a second DNS resolution to a different IP.
- Redirects remain blocked by rejecting non-2xx responses, and response bodies remain size-capped while streaming.
- Covered by `backend/src/catalog-spec-url-security.test.ts`.

### 58. Well-Formed Unknown Sandbox API Keys Triggered Catalog Lookups Before Invalid-Key Throttling

Severity: Low
OWASP API mapping: API4 Unrestricted Resource Consumption, API8 Security Misconfiguration
Status: Remediated

Evidence:
- Missing and malformed sandbox API-key headers were rejected before catalog API availability checks.
- A syntactically valid but unknown `ghk_...` key still caused the middleware to resolve the requested catalog API id before it determined that no `access_requests` row matched the key hash.
- The same path returned the generic access-denied branch with HTTP 403 instead of the invalid-credential HTTP 401 used for other invalid sandbox keys.

Impact:
Unauthenticated clients could send random well-formed sandbox key values to force avoidable catalog availability lookups before invalid-key throttling. The response status was also inconsistent with the credential failure, making invalid-key handling harder to reason about and monitor.

Remediation:
- Sandbox middleware now checks the key hash first.
- Unknown well-formed keys consume the invalid-key throttle and return HTTP 401 before resolving catalog API availability.
- Valid known keys still resolve the requested catalog API and enforce `sandbox_available` plus endpoint/API authorization before reaching sandbox handlers.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 59. Production-Scoped Access Requests Could Mint Sandbox-Usable Keys

Severity: Low to Medium
OWASP API mapping: API5 Broken Function Level Authorization, API6 Unrestricted Access to Sensitive Business Flows
Status: Remediated

Evidence:
- Access request submission accepts an `environment` value of either `sandbox` or `production`.
- Access request approval generated the same `ghk_...` API key format for approved requests regardless of the requested environment.
- Sandbox runtime authorization checked key status, expiry, owner approval, and API id, but did not check the stored `access_requests.environment` value.

Impact:
An explicitly production-scoped approval could still produce a key accepted by the sandbox middleware. This blurred the governance boundary between sandbox testing and production-access review, making environment-specific approvals and audits less reliable.

Remediation:
- Sandbox key lookup now carries the access-request environment into the runtime access decision.
- Legacy rows with a missing environment remain sandbox-compatible, while explicit non-sandbox environments are rejected with `ENVIRONMENT_NOT_ALLOWED` before sandbox handlers execute.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 60. Unlabeled Sandbox Identifier Values Could Bypass Audit Redaction

Severity: Low to Medium
OWASP API mapping: API3 Broken Object Property Level Authorization
Status: Remediated

Evidence:
- `redactSandboxLogValue()` redacted sensitive fields primarily by key name.
- Array entries and nested primitive values under generic keys such as `identifiers` or `values` were returned unchanged.
- Sandbox request/response bodies containing values like NINs, TINs, BRNs, driving permits, email addresses, or phone numbers under generic field names could therefore be written to console output and audit details in clear text.

Impact:
Sandbox audit logs could persist personal identifiers or contact details from OpenAPI examples, user-entered request bodies, or sandbox response bodies when those values were not paired with a known sensitive key. This weakens the reliability of audit-log redaction and increases exposure risk in support exports, database access, or log aggregation.

Remediation:
- Sandbox body redaction now also checks high-confidence sensitive string value patterns for national IDs, tax IDs, business registration numbers, driving permits, email addresses, and international phone numbers.
- Explicit `nin` and `tin` fields keep their existing partial-mask behavior before generic value-pattern redaction is applied.
- Covered by `backend/src/sandbox-logging-security.test.ts`.

### 61. Production Access Requests Blocked Separate Sandbox Access Requests

Severity: Low to Medium
OWASP API mapping: API6 Unrestricted Access to Sensitive Business Flows
Status: Remediated

Evidence:
- Access request submission captures `environment` as either `sandbox` or `production`.
- After runtime sandbox keys were correctly restricted to sandbox-scoped access requests, duplicate-request prechecks and atomic insert/approval guards still treated requests for the same consumer/API as duplicates regardless of environment.
- A production-scoped pending or active request could therefore block a separate sandbox-scoped request for the same consumer/API, even though the production-scoped key would not authorize sandbox execution.

Impact:
The environment boundary became inconsistent across the approval workflow. A consumer could be denied sandbox testing because a production request already existed, or a production approval flow could be used to prevent the same consumer from obtaining the sandbox credential needed for lower-risk validation.

Remediation:
- Duplicate pending/active access-request checks now include `COALESCE(environment, 'sandbox')` so legacy rows remain sandbox-compatible while explicit sandbox and production requests are evaluated separately.
- The same environment predicate is enforced in the atomic insert guard and approval duplicate guard to preserve race safety.
- Access matrix rows now include `environment` so parallel sandbox/production approvals can be distinguished.
- Covered by `backend/src/access-control-security.test.ts`.

## Positive Controls Observed

- Sessions are random, stored as SHA-256 hashes, expire after 24 hours, and are revoked on logout and account suspension.
- Passwords use per-user random salts with `crypto.scryptSync`, signup/login/MFA confirmation password inputs are bounded before hashing or verification, and public user responses expose only boolean MFA state rather than MFA secret or timestamp fields.
- Session cookies are `httpOnly`, `sameSite=strict`, `secure` in production, path-scoped, and duplicate session cookie names are rejected.
- Cookie-authenticated unsafe requests require an allowed frontend `Origin` header, while safe requests and non-cookie bearer-token/API-client flows remain available.
- Login is rate-limited by IP and normalized email.
- Authenticated MFA setup, enable, and disable attempts plus login-time MFA code guesses are rate-limited per user.
- Signup/login/app-load human verification supports Cloudflare Turnstile, fails closed in production when not configured, and applies local per-IP rate limiting before upstream Siteverify calls.
- Production startup rejects Cloudflare Turnstile test secrets and requires an allowed-hostname list.
- Cloudflare Turnstile Siteverify calls use a bounded timeout and fail closed if the upstream stalls.
- Production data encryption requires an explicit 32-byte key instead of arbitrary passphrase input, malformed base64-like strings are rejected, and encrypted-looking client values are re-encrypted unless they are valid decryptable ciphertext.
- Hosted Postgres connections default to SSL certificate verification, and production rejects unsafe database SSL overrides.
- Local Postgres helper entry points bind the development database to loopback instead of all host interfaces.
- Project-local ignore rules cover root, backend, and frontend `.env*` variants while explicitly allowing only env example files to be tracked.
- Production CORS requires explicit HTTPS deployed origins and rejects localhost origins.
- OpenAPI URL imports require HTTPS in production, production disallows unlisted spec URL hosts, outbound requests are pinned to the DNS address vetted by SSRF preflight, fetched bodies are capped while streaming, inline OpenAPI specs honor the same configured byte ceiling, OpenAPI path keys/server URLs cannot normalize into external authority URLs, and cyclic YAML aliases are rejected before specs are stored or parsed from existing rows for JSON responses.
- Frontend OpenAPI example generation tracks visited `$ref` pointers and caps traversal depth before rendering docs/catalog samples.
- Common defensive headers are centralized, and sensitive API, docs, catalog, and OpenAPI asset paths get no-store cache headers.
- Account-verification document responses omit internal storage references, document uploads ignore client-supplied storage references, the frontend does not over-post storage locators, and encrypted server-side storage metadata is retained internally.
- Sandbox audit/log path normalization redacts canonical and compatibility driving-permit identifiers.
- Sandbox audit/log body redaction covers short identifier keys, common OpenAPI-style aliases for national IDs, tax IDs, business registration numbers, permits, common PII aliases, unlabeled sensitive identifier/contact values, tokens, secrets, and key-like fields.
- Sandbox path resolution avoids unauthenticated full-catalog scans by verifying only the requested registered or built-in sandbox API id, honors each API's `sandbox_available` flag, rejects production-scoped access-request keys at runtime, skips catalog or access-request lookups entirely for missing or malformed API-key headers, and rejects well-formed unknown API keys before catalog availability lookups.
- Admin and reviewer API-call audit filters preserve full sandbox event visibility while developer reads remain scoped to their own activity.
- Sandbox API keys are random, stored hashed for runtime validation, previewed only partially, revocable, expirable, rate-limited, and redacted with other credential-like headers before request or response headers are displayed in the frontend response console.
- Frontend API credential inclusion parses URL origins and base paths instead of using string prefix matching.
- Account review notifications stored in browser `localStorage` avoid free-form rejection reasons and review notes.
- Access request submission and API key reveal are developer-only; key reveal is one-time and atomically clears the encrypted key material, and duplicate access-request checks are scoped by environment.
- Sandbox audit paths and bodies redact identifiers, common contact values, authorization headers, cookies, tokens, secrets, and key-like fields.
- OpenAPI URL imports restrict hosts unless explicitly allowed, block private/local/reserved IP ranges after DNS resolution, pin outbound requests to the vetted address, reject redirects, apply timeouts, and enforce max response size without buffering oversized bodies.
- Documentation visibility supports public, authenticated, and restricted modes; restricted docs require admin/reviewer, owning MDA API owner, or approved consumer access.
- Catalog detail responses use an explicit metadata field allowlist and omit stored OpenAPI spec text.
- Route mutations use parameterized SQL and role/ownership checks for admin, API owner, reviewer, and developer workflows.
- Catalog version publish/promote/delete re-check API ownership inside the write transaction to avoid stale pre-check authorization.
- Catalog version listing applies bounded pagination before returning version history rows.
- Account signup and approval enforce role/category compatibility and verified-category MDA requirements before elevated reviewer, API owner, or administrator roles are assigned.
- Admin user listing validates status filters and applies bounded pagination before account snapshot hydration.
- Access request listing applies bounded pagination before joining and returning access governance rows.
- Access matrix listing applies bounded pagination before returning active API/consumer pairings.
- Catalog and docs listings apply visibility filters and bounded pagination in SQL, including single-query developer restricted-doc access checks.

## Verification Performed

- `npm test` in `backend`: passed after additional remediation.
- `npm run test:security-config` in `backend`: passed after production demo-mode rejection, additional production config, and encryption-key hardening.
- `npm run test:db-security` in `backend`: passed after database TLS hardening.
- `npm run test:local-env-security` in `backend`: passed after hardening project-local env ignore patterns.
- `npm run test:local-postgres-security` in `backend`: passed after binding local Postgres helpers to loopback.
- `npm run test:catalog-spec-url-security` in `backend`: passed after OpenAPI URL import HTTPS, DNS-pinned request hardening, streamed-size hardening, inline spec size-limit hardening, OpenAPI path/server authority normalization hardening, cyclic YAML alias rejection, and stored-spec parser hardening.
- `npm run test:catalog-versions-security` in `backend`: passed after catalog version ownership race hardening and version list pagination hardening.
- `npm run test:catalog-detail-security` in `backend`: passed after catalog detail response field allowlisting.
- `npm run test:crypto-at-rest-security` in `backend`: passed after encrypted-field prefix hardening.
- `npm run test:docs-access-security` in `backend`: passed after catalog/docs list pagination and developer N+1 access-check hardening.
- `npm run test:access-control-security` in `backend`: passed after privileged API-call audit filter hardening, access request list pagination hardening, access matrix pagination hardening, non-developer one-time API key reveal rejection, non-developer access request submission rejection, and environment-scoped duplicate access-request lifecycle checks.
- `npm run test:security-headers` in `backend`: passed after defensive header and protected docs/spec no-store hardening.
- `npm run test:admin-users-list-security` in `backend`: passed after admin user list status validation and bounded pagination hardening.
- `npm run test:account-role-security` in `backend`: passed after account role/category compatibility hardening.
- `npm run test:account-approval-security` in `frontend`: passed after aligning approval MDA defaults with verified account category and preventing free-form account-review text from being stored in persistent local notifications.
- `npm run test:fetch-credentials-security` in `frontend`: passed after replacing frontend API credential prefix checks with parsed origin/base-path matching.
- `npm run test:account-verification-security` in `backend`: passed after removing document `storage_ref` from account snapshots and stripping client-supplied `storage_ref` from validated document upload input.
- `npm run test:document-storage-security` in `frontend`: passed after removing client-generated document storage references from upload payloads.
- `npm run test:openapi-example-security` in `frontend`: passed after bounding recursive OpenAPI example generation.
- `npm run test:sandbox-logging-security` in `backend`: passed after redacting canonical driving-permit sandbox paths, common identifier aliases, common PII aliases and unlabeled sensitive identifier/contact values in sandbox audit bodies, hardening dynamic sandbox path resolution, enforcing `sandbox_available` for built-in sandbox mappings, rejecting production-scoped access-request keys at the sandbox boundary, skipping catalog lookups for missing sandbox API keys, rejecting malformed sandbox API keys before catalog or access-request lookups, and rejecting well-formed unknown sandbox API keys before catalog availability lookups.
- `npm run test:turnstile-security` in `backend`: passed after adding a bounded Turnstile Siteverify timeout.
- `npm run test:auth-turnstile-rate-limit-security` in `backend`: passed after adding pre-upstream human-verification rate limiting.
- `npm run test:auth-signup-security` in `backend`: passed after bounding signup passwords before hashing.
- `npm run test:auth-password-confirmation-security` in `backend`: passed after bounding MFA password confirmations before rate-limit writes and password verification.
- `npm run test:auth-mfa-rate-limit-security` in `backend`: passed after adding per-user MFA setup/enable/disable attempt limits and login-time MFA guess throttling.
- `npm run test:auth-session-security` in `backend`: passed after adding session revocation to account suspension, duplicate session-cookie rejection, public-user MFA timestamp stripping, and cookie-authenticated unsafe-method Origin checks.
- `npm run test:api-key-storage` in `frontend`: passed after removing full-key browser persistence, redacting displayed sandbox request/response headers, preventing admin sessions from attempting one-time key auto-reveal, and disabling catalog access requests for non-developer sessions.
- `npm test` in `frontend`: passed after remediation.
- `npm test` at repository root: passed after additional remediation.
- `npm run build` at repository root: passed after remediation; Vite reported the existing large chunk warning.
- `git diff --check` at repository root: passed after remediation.
- Search verification found no `govhub_api_key` full-key persistence references in `frontend/src` or `backend/src`.
- `npm audit --omit=dev` in `backend`: 0 vulnerabilities.
- `npm audit --omit=dev` in `frontend`: 0 vulnerabilities.
- Secret/config check: committed files include only `.env.example`, `backend/.env.example`, and `frontend/.env.example`; local secret-bearing `.env`, `.env.production.local`, backend `.env`, and frontend `.env` files are not tracked by git.

## Retest Checklist

1. Run `npm test` from the repository root before release.
2. In a production-like environment, verify startup succeeds only when `GOVHUB_DEMO_MODE=false`, `GOVHUB_DATA_ENCRYPTION_KEY` is a 32-byte hex or canonical standard base64 key, `GOVHUB_ADMIN_PASSWORD` is set, `GOVHUB_REQUIRE_ADMIN_MFA=true`, a non-test Turnstile secret is set, `GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES` is set, `GOVHUB_ALLOWED_ORIGINS` is set to deployed HTTPS frontend origins, and database SSL certificate verification is not disabled.
3. Validate admin routes reject approved admin users without MFA in production.
4. Reveal a sandbox API key and confirm frontend source and browser behavior do not persist full keys to `sessionStorage`.
5. Test OpenAPI URL import with localhost, link-local metadata IPs, private IPs, redirects, oversized responses without `Content-Length`, invalid `Content-Length`, a DNS-rebinding host that changes from public to private between preflight and request, `http:` URLs in production, and an allowed HTTPS public host.
6. Race API ownership transfer against catalog version publish, promote, and delete operations; stale API owners should receive a conflict and no version state should change.
7. Attempt signup and approval role tampering across account categories; incompatible reviewer, API owner, or admin assignments should be rejected server-side.
8. Run sandbox requests and OpenAPI fallback examples with names, dates of birth, phone numbers, emails, addresses, NINs, TINs, BRNs, and permits; console/audit logs should redact those fields while preserving non-sensitive status fields.
9. Simulate a stalled Cloudflare Siteverify response and confirm login/signup human verification fails closed with `TURNSTILE_UNAVAILABLE` within the configured `GOVHUB_TURNSTILE_TIMEOUT_MS`.
10. Compare `/api/access/audit-logs?scope=api-calls` as admin/reviewer and as developer; admin/reviewer should see all sandbox API-call events, while developer should see only their own/user-MDA scoped API-call events.
11. Fetch `/api/docs`, `/api/catalog/:id/spec`, and `/openapi/:filename` for restricted APIs and confirm responses include `Cache-Control: no-store`.
12. Submit `POST /api/auth/account/documents` with an over-posted `storage_ref`; the stored reference should be server-generated for the authenticated user and account snapshots should not expose it.
13. Send repeated invalid `/api/auth/mfa/disable`, `/api/auth/mfa/enable`, and `/api/auth/mfa/setup` attempts for the same authenticated user; attempts beyond `GOVHUB_MFA_RATE_LIMIT` should return `MFA_RATE_LIMITED`.
14. Suspend an approved user with an active session and confirm `sessions.revoked_at` is set for that user's active sessions during the suspend transaction.
15. Submit `POST /api/auth/signup` with a valid but 1025-character password; the response should be HTTP 400, no user should be created, and the error should identify the 1024-character limit.
16. Submit `/api/auth/mfa/setup` and `/api/auth/mfa/disable` with a 1025-character `password`; each response should be HTTP 400 with `INVALID_PASSWORD_INPUT` before password verification or MFA state changes.
17. Upload or replace an account verification document from the frontend and confirm the JSON request body contains only `type`, `label`, `file_name`, and `mime_type`; no `storage_ref` or `s3://` locator should be generated client-side.
18. Request `/api/admin/users?limit=1000000&offset=-5` and confirm the backend uses a bounded 100-row page with offset `0`; request `/api/admin/users?offset=1000000000` and confirm the offset is capped at `10000`; request an invalid `status` value and confirm it is rejected with `INVALID_USER_STATUS` before querying users.
19. Request `/api/access?limit=1000000&offset=-5` as a privileged user and confirm the backend uses a bounded 100-row page with offset `0`; request `/api/access?offset=1000000000` and confirm the offset is capped at `10000`.
20. Request `/api/catalog?limit=1000000&offset=-5` and `/api/docs?limit=1000000&offset=-5` and confirm each endpoint uses a bounded 100-row page with offset `0`; as an approved developer with restricted API access, confirm docs/catalog listing uses a single query with an approved-access `EXISTS` predicate rather than per-API access lookups.
21. Request `/api/access/matrix?limit=1000000&offset=-5` as an admin or reviewer and confirm the backend uses a bounded 100-row page with offset `0`; request `/api/access/matrix?offset=1000000000` and confirm the offset is capped at `10000`.
22. Request `/api/catalog/:id/versions?limit=1000000&offset=-5` for a visible API and confirm the backend uses a bounded 100-row page with offset `0`; request `/api/catalog/:id/versions?offset=1000000000` and confirm the offset is capped at `10000`.
23. Request an unknown `/api/v1/not-registered/status` path without `X-GovHub-API-Key` and confirm the backend does not scan all sandbox-enabled APIs; request `/api/v1/sandbox/:apiId/status` and confirm it verifies only `:apiId` before returning the missing-key response.
24. Request `/api/catalog/:id` for a visible API and confirm the response includes catalog metadata and `openapi_spec_path`, but does not include `openapi_spec_text` or unlisted internal catalog columns.
25. Submit a public-developer signup, change the verification profile category to `government_employee`, submit for review, and attempt reviewer approval without `mda_id`; the backend should reject it, while the admin UI should default to requiring an MDA based on the submitted profile category.
26. Set `sandbox_available=false` for a built-in sandbox API such as the identity API and call `/api/v1/identity/status/:nin` with an otherwise valid API key for that API; the middleware should reject the call instead of routing it to the sandbox handler.
27. Submit profile or document metadata containing a malformed encrypted-looking value such as `enc:v1:not-a-valid-envelope`; account snapshot/admin review reads should still work, and the stored field should round-trip as plaintext after encrypted storage.
28. Set `GOVHUB_TURNSTILE_RATE_LIMIT=2`, configure a non-test Turnstile secret, and send three `/api/auth/human-verification` requests from the same IP; the third response should be HTTP 429 with `HUMAN_VERIFICATION_RATE_LIMITED` and should not call Siteverify.
29. Publish or validate an OpenAPI schema where `#/components/schemas/Node` contains a child `$ref` back to itself; docs and catalog pages should render examples without stack overflow, omitting the recursive branch after the first safe object.
30. Send a request with two `govhub_session` cookies in the same `Cookie` header; backend session parsing should reject the cookie credential and treat the request as unauthenticated.
31. Submit six bad `/api/auth/login` TOTP codes for the same MFA-enabled account from different IPs after a correct password; attempts beyond `GOVHUB_MFA_RATE_LIMIT` should return `MFA_RATE_LIMITED`.
32. Set `GOVHUB_SPEC_MAX_BYTES=10` and submit an 11-byte inline `openapi_spec` or `specText`; catalog registration, catalog patch, and spec validation should reject it with `Specification content is too large.`
33. Fetch `/api/auth/me` or `/api/admin/users` for an MFA-enabled account and confirm the user object includes `mfa_enabled: true` but omits `password_hash`, `mfa_secret_encrypted`, and `mfa_enabled_at`.
34. Submit or validate an OpenAPI spec with a path key like `//attacker.example/collect` or `/\attacker.example/collect`; catalog registration, catalog patch, spec validation, and version parsing should reject it before the spec can reach docs or sandbox URL builders.
35. Submit or validate an OpenAPI spec with `servers: [{ url: "//attacker.example" }]` or `servers: [{ url: "/\\attacker.example" }]`; catalog registration, catalog patch, spec validation, and version parsing should reject it before docs or sandbox URL builders use the server URL.
36. Submit or validate a YAML OpenAPI spec where an anchored path item references itself through an alias; catalog registration, catalog patch, spec validation, and version parsing should reject it with a circular YAML alias error before it can be served through JSON spec endpoints.
37. Seed an existing database row with a stored cyclic-alias OpenAPI spec and fetch `/api/catalog/:id/spec`, `/api/docs/:id/spec`, or sandbox OpenAPI fallback behavior; each parser path should reject via the shared stored-spec validator instead of raw `yaml.load()` serialization.
38. Paste a full sandbox API key into the sandbox console, send a request, and confirm the response console displays `[REDACTED]` for `X-GovHub-API-Key`, `Authorization`, `Cookie`, password, credential, token, secret, and API-key-like request/response headers while the actual request still reaches the sandbox with the original header values.
39. Call `/api/v1/identity/status/:nin` or `/api/v1/sandbox/:apiId/status` without `X-GovHub-API-Key`; the request should be invalid-key throttled and rejected without querying catalog API availability.
40. Create an approved legacy MDA-level access request with `consumer_user_id` unset, then call `POST /api/access/:id/reveal-key` as an admin in the same consumer MDA; the response should be HTTP 403, the encrypted one-time key should remain available, no key-revealed audit record should be written, and the dashboard should not auto-call the reveal endpoint from an admin session.
41. Attempt `POST /api/access` as an admin, reviewer, or API owner; each should return HTTP 403 before inserting an `access_requests` row, and catalog detail should keep the request-access action disabled for those roles.
42. Start the local Postgres container through Docker Compose or `scripts/local-postgres.mjs` and confirm the published port is bound to `127.0.0.1` only; override `GOVHUB_POSTGRES_PORT` when a different loopback host port is needed.
43. Run `git check-ignore -v .env.production.local backend/.env frontend/.env` from the project root and confirm production-style local env files are ignored; rotate any database or Vercel credentials that have existed in local production env files.
44. Call a sandbox route with `X-GovHub-API-Key: not-a-govhub-key`; it should return HTTP 401 with `INVALID_API_KEY` and should not query catalog availability or `access_requests` before consuming the invalid-key quota.
45. From the frontend, issue credentialed fetches to `/api/auth/me`, the exact configured `API_BASE`, a hostname that merely prefixes `API_BASE`, and a path that merely prefixes an API base path; only the relative `/api` and exact configured API origin/path should receive `credentials: 'include'`.
46. Reject an account or request more verification information with sensitive free-form text, then inspect `localStorage` keys beginning with `govhub_notifications:`; the local notification should contain only the generic account-status message, while account settings should retrieve the authoritative backend review text.
47. Send `POST /api/auth/logout` or another cookie-authenticated state-changing API request with a `govhub_session` cookie and no `Origin` header; it should return HTTP 403. Repeat with an Origin in `GOVHUB_ALLOWED_ORIGINS`; it should pass the CSRF boundary and reach normal route authorization.
48. Call a sandbox route with a syntactically valid but unknown `X-GovHub-API-Key: ghk_<64 lowercase hex characters>`; it should return HTTP 401 with `INVALID_API_KEY`, consume invalid-key quota, and not query catalog API availability before rejecting the request.
49. Approve an access request whose stored environment is `production`, reveal the key, and call a sandbox endpoint with that key; the request should return HTTP 403 with `ENVIRONMENT_NOT_ALLOWED` before the sandbox handler executes.
50. Send a sandbox request or response body with generic array fields such as `{ "identifiers": ["CM99021234567X", "1000123456", "BRN12345", "WP30219", "john.doe@example.com", "+256700000000"] }`; console output and audit details should redact those sensitive values even though the field names are generic.
51. Create a production-scoped pending or active access request for a consumer/API, then submit a sandbox-scoped request for the same consumer/API; the sandbox request should not be blocked by the production request, while a second sandbox request should still return `ACCESS_REQUEST_ALREADY_EXISTS`.
