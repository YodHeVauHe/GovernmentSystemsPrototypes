# Ministry Demo Use Case: Uganda GovHub API

## Purpose

This use case describes the ministry-facing demo path for Uganda GovHub API. It shows how the Ministry of ICT and National Guidance can demonstrate secure, auditable interoperability between Ministries, Departments, and Agencies without exposing real citizen records.

## Demo Narrative

A Ministry of Health service team needs to determine whether a citizen or supplier is eligible for a bundled public service. Today, the team would need to request identity, tax, business, and permit information from separate agencies through manual processes. Uganda GovHub API demonstrates a unified, governed way to request access, test APIs in a sandbox, and audit the resulting inter-agency data exchange.

## Participating Agencies

- **MoICT:** Platform steward, reviewer, and policy owner for GovHub API.
- **MoH:** Consumer MDA requesting lawful access to APIs.
- **NIRA:** Owner of the Identity Verification API.
- **URA:** Owner of the Tax Compliance Status API.
- **URSB:** Owner of the Business Registration Lookup API.
- **MoWT:** Owner of the Driving Permit Verification API.

## Demo Roles

- **Developer:** Represents a consuming MDA, typically MoH, discovering APIs and requesting access.
- **API Owner:** Represents a data-owning MDA reviewing access requests for its APIs.
- **Reviewer:** Represents MoICT governance or compliance review.
- **Admin:** Represents MoICT platform administration, including API registration and catalog governance.

## Demo Accounts

Use the seeded accounts below for a repeatable local demo:

| Role | Email | Password |
| --- | --- | --- |
| Platform admin | `admin@ict.go.ug` | `AdminPass123!` |
| MDA developer | `demo.developer@govhub.go.ug` | `DemoDeveloper123!` |
| NIRA API owner | `demo.api.owner@nira.go.ug` | `DemoApiOwner123!` |
| Compliance reviewer | `demo.reviewer@govhub.go.ug` | `DemoReviewer123!` |

Run the demo locally with:

```bash
npm run seed
npm run dev
```

The frontend runs on the Vite URL shown in the terminal. The backend sandbox API defaults to `http://127.0.0.1:4000`.

## Core Demo Flow

### 1. Discover Government APIs

Log in as the MDA developer, then open the Interoperability Catalog at `/`. Show the available API products:

- NIRA Identity Verification API
- URA Tax Compliance Status API
- URSB Business Registration Lookup
- MoWT Driving Permit Verification API
- Service Uganda Composite Eligibility

The key message is that MDAs can discover standard, documented services from one place instead of relying on informal integrations. The catalog supports search and filters by sector, lifecycle, sensitivity, and compliance status.

### 2. Inspect Governance Metadata

Open an API detail view, then show the governance tab and API summary fields:

- Owning MDA
- Sector
- Sensitivity level
- Security classification
- Statutory basis
- Purpose limitation
- Data minimization note
- Retention class
- SLA target
- Compliance status

The key message is that GovHub treats APIs as governed public infrastructure, not just technical endpoints.

The API detail view also exposes version metadata, downloadable OpenAPI assets where visibility permits, and a print-friendly governance summary.

### 3. Request Access

As the MDA developer, request sandbox access to an API and provide:

- Business purpose
- Legal basis
- Requested fields
- Environment
- Volume tier

The key message is that access requests must be explicit, purposeful, and reviewable.

### 4. Review and Approve

Log in as the platform admin or NIRA API owner and open `/dashboard`. Review the pending access request and approve it. Approval generates a scoped sandbox API key with expiry controls.

The key message is that each data-owning MDA remains accountable for access to its datasets.

After approval, return as the developer, open the same API detail page, and use the sandbox try-it panel with the approved key. The sandbox returns correlation IDs, rate-limit headers, and structured errors for denied calls.

### 5. Demonstrate the Interoperability Matrix

As the admin or reviewer, open the Interoperability Matrix tab in `/dashboard` to show which consuming MDAs have approved active access to which source APIs.

The key message is that MoICT can see the active government data-sharing map across agencies.

### 6. Inspect Audit Logs

Open the Audit Trails and Analytics tabs in `/dashboard` and show platform events such as:

- Access requested
- Access approved or denied
- API registered
- Sandbox activity
- API key generated, revoked, deleted, or expiry updated

The key message is that GovHub provides traceability for policy, security, and compliance oversight.

### 7. Register a New API

As a MoICT admin or authorized API owner, open `/catalog/add`. Use the Add API flow to validate an OpenAPI specification, capture governance metadata, and register the API into the catalog.

The key message is that new ministry APIs can be onboarded through a standardized validation and governance process.

The current implementation supports registering a new API, editing catalog metadata, managing OpenAPI versions, selecting a current version, and deleting non-current versions.

## Recommended Live Demo Script

1. Start as the seeded MDA developer and open the catalog.
2. Search for NIRA Identity Verification API.
3. Open the API detail view and explain the statutory basis and data minimization controls.
4. Submit an access request for service eligibility verification.
5. Log out and log in as the platform admin or NIRA API owner.
6. Approve the pending request.
7. Log back in as the developer and run a sandbox request with the approved key.
8. Attempt a sandbox call without a key or with the wrong API key to show a denied structured response.
9. Log in as admin or reviewer and open the interoperability matrix to show the new approved channel.
10. Open audit logs and analytics to show the event trail and sandbox call outcomes.
11. As admin, register a draft API from an OpenAPI specification.

## Success Criteria

The demo is successful when the audience can see:

- A single catalog of government APIs across MDAs.
- Clear ownership and statutory basis for each API.
- A governed request and approval process.
- A visible matrix of approved data-sharing channels.
- Audit logs for accountability.
- A repeatable onboarding process for new ministry APIs.

## Current Demo Readiness

The demo is aligned with the current app for the core ministry flow:

- Catalog discovery for five seeded government APIs.
- Governance metadata and OpenAPI documentation per API.
- Access request, approval, API key issuance, expiry, revocation, and deletion.
- Sandbox try-it execution with approved keys.
- Denied sandbox responses for missing, expired, revoked, or incorrectly scoped keys.
- Audit logs, analytics, and interoperability matrix in the dashboard.
- API registration and OpenAPI validation through the Add API flow.

Implemented demo support:

- Seeded accounts support presenter role changes through normal login/logout.
- `npm run test:e2e` runs Playwright automation for the ministry presenter flow.
- `npm run test:a11y` runs automated axe accessibility checks for core demo pages.
- API docs and API detail pages include generated cURL, JavaScript, Python, and Java request samples.

## Positioning for Ministry Stakeholders

Uganda GovHub API is a digital public infrastructure prototype for secure data exchange. It helps MoICT demonstrate how ministries can move from siloed, manual verification to governed, auditable, API-based service delivery.
