# Uganda GovHub API: Interoperability and Data Exchange

## Thematic Area

**Area 10: Interoperability and Data Exchange** - government API platforms, data integration middleware, and governed MDA data exchange.

## Purpose

Uganda GovHub API is a working prototype for a government API developer portal and sandbox. It demonstrates how Ministries, Departments, and Agencies can discover APIs, review governance metadata, request access, test integrations with mock data, and audit data-sharing activity from one place.

The prototype is designed for the Ministry of ICT and National Guidance innovator showcase. It is not connected to live NIRA, URA, URSB, NITA-U, or other production government systems.

## Problem

Many government systems still operate as isolated silos. A ministry or agency often has to verify identity, tax, business, permit, or service eligibility information through manual requests or fragmented channels. That slows service delivery, increases duplication, and weakens traceability.

## Solution

GovHub API models a secure interoperability layer around government APIs:

- A searchable API catalog for MDA-owned services.
- Custom OpenAPI documentation pages for each registered API.
- Sandbox endpoints with deterministic mock responses and structured errors.
- Access request and approval workflows for governed data sharing.
- Scoped sandbox API keys with expiry, revocation, and audit trails.
- Dashboard views for approvals, accounts, access matrix, analytics, and audit logs.
- API registration and OpenAPI validation for onboarding new ministry services.

## Current Implementation

The app is implemented as a local full-stack prototype:

- **Frontend:** React, TypeScript, Vite, React Router, and GovHub-specific UI components.
- **Backend:** Node.js, Express, TypeScript, SQLite via `better-sqlite3`.
- **API contracts:** OpenAPI files stored in `backend/openapi/`.
- **Auth:** Cookie-backed sessions with seeded demo accounts.
- **Security controls:** MFA setup and enforcement, role-based access control, sensitive field encryption at rest, TLS/HSTS support, audit logging, and privacy metadata aligned to Uganda's Data Protection and Privacy Act, 2019.
- **Integrations:** Mock/sandbox services for NIRA-style identity verification, URA-style tax status, URSB-style business lookup, driving permit verification, and composite eligibility checks. There are no live external integrations.

## Local Demo

Install dependencies:

```bash
npm run install:all
```

Seed the local SQLite database:

```bash
npm run seed
```

Start the frontend and backend:

```bash
npm run dev
```

The frontend runs on the Vite dev-server URL shown in the terminal. The backend defaults to `http://127.0.0.1:4000`.

For e2e-style local startup with explicit host and port values:

```bash
npm run dev:e2e
```

Useful scripts:

```bash
npm run lint
npm run build
npm test
npm run test:e2e
npm run test:a11y
```

## Demo Accounts

Demo accounts are seeded automatically:

| Role | Email | Password |
| --- | --- | --- |
| Platform admin | `admin@ict.go.ug` | `AdminPass123!` |
| MDA developer | `demo.developer@govhub.go.ug` | `DemoDeveloper123!` |
| NIRA API owner | `demo.api.owner@nira.go.ug` | `DemoApiOwner123!` |
| Compliance reviewer | `demo.reviewer@govhub.go.ug` | `DemoReviewer123!` |

## Key Routes

| Route | Purpose |
| --- | --- |
| `/` | API catalog and API detail workflow |
| `/docs` | Visible OpenAPI documentation index |
| `/docs/:apiId` | Per-API technical documentation |
| `/catalog/add` | Admin/API-owner API registration flow |
| `/dashboard` | Approvals, accounts, access matrix, audit trails, and analytics |
| `/settings` | Account profile, MFA, verification, and access group information |

## Security Configuration

Set `GOVHUB_DATA_ENCRYPTION_KEY` to a strong 32-byte base64 value or passphrase before using persistent data.

For HTTPS directly from the backend, set:

```bash
GOVHUB_TLS_CERT_PATH=/path/to/cert.pem
GOVHUB_TLS_KEY_PATH=/path/to/key.pem
```

If TLS is terminated by a reverse proxy or hosting platform, set:

```bash
GOVHUB_TRUST_TLS_TERMINATION=true
```

That lets the backend emit HSTS headers while still running behind external TLS termination.

## Presenter Path

1. Log in as the MDA developer and search the catalog for identity, tax, business, permit, or composite services.
2. Open an API detail page, review governance metadata, and submit a sandbox access request.
3. Log in as the platform admin or NIRA API owner and approve the request from the dashboard.
4. Return to the API detail page and run a sandbox request with the approved key.
5. Open the dashboard access matrix, audit logs, and analytics to show oversight and traceability.
6. Register a draft API from an OpenAPI specification to show the onboarding workflow.

## Form Positioning

For innovation-showcase forms:

- **RESTful API:** Yes. The backend exposes REST endpoints.
- **GraphQL API:** No.
- **NIRA / National ID:** Demonstrated through mock identity verification APIs, not a live NIRA integration.
- **URA systems:** Demonstrated through mock tax compliance APIs, not a live URA integration.
- **NITA-U infrastructure:** The prototype is positioned as complementary to national interoperability infrastructure, but it is not connected to live NITA-U infrastructure.
- **No external integrations currently:** Yes for live production systems. The current integrations are sandbox mocks.
- **Security features:** MFA, RBAC, encryption at rest, TLS support, audit logging, and privacy metadata are implemented. Penetration testing is not completed.
