# Authentication and Admin Verification Design

## Goal

Add login and sign up for Uganda GovHub API users while preserving government-grade access control. Public visitors can browse the catalog, but registered users must be verified by an administrator before they can use operational dashboard features.

## User States

- `PUBLIC`: no account. Can browse published API catalog and public API detail metadata.
- `PENDING_REVIEW`: signed up but not verified. Can log in and see account review status only.
- `APPROVED`: verified by admin. Can use the role assigned during approval.
- `REJECTED`: reviewed and denied. Can log in and see rejection status.
- `SUSPENDED`: previously approved but disabled. Cannot use operational features.

## Roles

- `developer`: can request access to APIs after approval.
- `api_owner`: can manage APIs owned by their MDA after approval.
- `reviewer`: can inspect access requests and audit logs after approval.
- `admin`: can approve users, assign roles, and manage platform-level records.

Public sign up does not grant any role power. New users may request a role and MDA, but the backend stores them as requested values until an admin approves the account.

## Access Groups

Access groups describe what a person can do before and after verification. They are broader than roles because they include public visitors and account review states, not only approved platform roles.

### Public Access

Public access is for citizens, private-sector developers, researchers, civil society, and government staff who have not logged in. This group can view published API catalog entries, public documentation, owning institution details, API lifecycle status, sandbox availability, contact offices, and general compliance metadata. Public access must never expose API keys, private audit logs, pending access requests, sensitive test payloads, or administrative actions. This keeps the platform transparent without turning transparency into operational access.

### Registered Applicant

Registered applicants have created an account but have not yet been approved. They can log in, view their account status, update basic profile details if that endpoint is later added, and wait for review. They cannot request API keys, access the operational dashboard, submit API access requests, approve requests, register APIs, or call protected sandbox endpoints. This group is important because it lets the public enter the system without granting trust prematurely.

### Verified Developer

Verified developers are approved users who have a legitimate integration purpose. They can request access to APIs, view their own requests, receive API keys after request approval, and use approved sandbox endpoints. They cannot approve their own requests, view other organizations' secrets, manage API catalog records, or review other users. This group supports public and government developers while keeping API-level approval separate from account approval.

### Verified API Owner

Verified API owners represent an MDA that owns one or more APIs. They can view access requests for APIs owned by their MDA, review request context, and participate in approval workflows where policy allows. They can manage metadata for APIs owned by their MDA if the platform enables owner-side editing. They cannot approve user accounts or manage unrelated MDAs' APIs.

### Compliance Reviewer

Compliance reviewers inspect access requests, audit logs, API metadata, statutory basis, data minimization notes, and security classifications. They are read-focused by default. They can flag or assess records, but they do not receive broad write permissions unless explicitly granted through an admin workflow. This group supports oversight without mixing review duties with platform administration.

### Platform Administrator

Platform administrators are trusted operators, typically under the central platform-owning MDA. They can approve, reject, or suspend user accounts; assign verified roles and MDAs; manage API registrations; approve or revoke API keys; and view audit logs. Admin access is the highest-risk group and must only be granted through existing approved admin accounts, never through self-service sign up.

### Suspended or Rejected Account

Suspended and rejected accounts can log in only to see their account status. They cannot use platform workflows or API access. Suspended accounts are for temporary or security-driven disablement; rejected accounts are for applications that fail verification.

## Backend Design

Create a `users` table with identity, email, password hash, requested role/MDA, approved role/MDA, status, and review timestamps. Passwords are hashed with Node's built-in `crypto.scryptSync` and never stored in plaintext. Sessions use bearer tokens stored in a `sessions` table with expiry.

Add `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout`. Add admin endpoints to list pending users and approve, reject, or suspend accounts. Middleware will authenticate bearer tokens and require approved status plus role checks for protected operations.

User IDs are crypto-generated public identifiers, not sequential database IDs. New accounts receive IDs in the form `usr_<uuid>` from `crypto.randomUUID()`, which avoids exposing signup order and makes IDs difficult to guess.

## Asymmetric Machine Access

For government-to-government and approved private-sector integrations, API access should move beyond long-lived shared API keys. The stronger model is asymmetric request signing:

- Each approved integration generates its own public/private key pair.
- The private key never leaves the consuming organization.
- GovHub stores only the public key, key identifier, owner MDA, allowed API scopes, status, expiry, and rotation history.
- Each API call includes a key ID, timestamp, nonce, request digest, and digital signature.
- GovHub verifies the signature with the registered public key, rejects replayed nonces, checks timestamp drift, and then applies the same MDA/API approval rules.
- Key registration, rotation, suspension, and revocation are admin-reviewed actions and must be audit logged.

A blockchain-style ledger can be useful as a tamper-evident audit anchor for key registrations, approvals, and revocations, but it should not replace backend authorization. The source of truth for access decisions remains the verified account, approved MDA, approved API scope, active key status, expiry, and audit trail.

## Frontend Design

Replace local role switching as the source of truth with authenticated user state from `/api/auth/me`. Add login and sign up pages. Unauthenticated users can browse the catalog layout, while protected routes redirect to login. Pending, rejected, and suspended users see a focused account-status screen.

## Access Policy

Catalog read endpoints remain public. Mutating catalog endpoints, access request creation, access approval, key management, audit logs, and dashboard operations require authenticated approved users with the correct role.

## Testing

Backend tests cover password hashing, signup defaults, login token issuance, pending users being blocked, role checks, and admin approval. Frontend verification is done with TypeScript build after integrating the auth context and routes.
