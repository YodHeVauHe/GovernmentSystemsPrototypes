# Uganda GovHub API MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Swagger/Stoplight-style developer portal and sandbox MVP for Ugandan government interoperability APIs.

**Architecture:** A single web application serves the developer portal, API catalog, interactive OpenAPI documentation, mock sandbox endpoints, access request workflow, and admin dashboard. API definitions are stored as OpenAPI files and enriched with Uganda-specific governance metadata.

**Tech Stack:** Recommended baseline is Next.js or React for the portal, Node.js/Express or FastAPI for sandbox APIs, OpenAPI 3.1 for specs, Swagger UI or Redoc/Scalar for rendering, Prism or custom mock handlers for predictable sandbox responses, SQLite/PostgreSQL for MVP persistence, and Playwright for end-to-end demo validation.

---

## Delivery Principles

- Build the demo around official-looking workflows, not real citizen records.
- Keep UGHub positioning accurate: this is a developer and governance portal model that could sit around or beside an integration platform.
- Use mock data only.
- Treat data minimization as a visible product feature.
- Make the demo runnable offline once dependencies are installed.
- Keep the first version small enough to present confidently in 10 minutes.

## Phase 1: Project Foundation

- [ ] Create application skeleton with `frontend/`, `backend/`, `openapi/`, `data/`, and `docs/` folders.
- [ ] Add a root `package.json` or equivalent workspace config with scripts for `dev`, `test`, `lint`, and `demo`.
- [ ] Add `.env.example` with sandbox defaults only.
- [ ] Add README run instructions for local demo.
- [ ] Add seed data for MDAs, APIs, access policies, mock consumers, and audit events.

Expected output:

- Local app starts with one command.
- Home route opens the API catalog.
- No external production systems are required.

## Phase 2: API Catalog

- [ ] Define catalog data model:
  - API ID
  - API name
  - Owning MDA
  - Sector
  - Description
  - Lifecycle status
  - Sensitivity level
  - Sandbox availability
  - OpenAPI spec path
  - Required approval level
  - Contact office
- [ ] Implement catalog list page with search and filters.
- [ ] Implement API detail page showing overview, owner, governance metadata, endpoint groups, versions, and access status.
- [ ] Add catalog entries for:
  - NIRA Identity Verification
  - URA Tax Compliance Status
  - URSB Business Registration Lookup
  - Driving Permit Verification
  - Service Uganda Composite Eligibility

Expected output:

- Demo user can search "tax", "identity", or "permit" and reach the correct API.
- Every API shows the responsible MDA and data governance summary.

## Phase 3: OpenAPI Documentation Experience

- [ ] Create OpenAPI 3.1 specs under `openapi/`.
- [ ] Include realistic request schemas, response schemas, examples, error codes, and sandbox API key security schemes.
- [ ] Render docs in the API detail page using Swagger UI, Redoc, Scalar, or an equivalent OpenAPI renderer.
- [ ] Add "Download OpenAPI JSON" and "Download OpenAPI YAML" actions.
- [ ] Add code samples for cURL, JavaScript, Python, and Java where the renderer does not generate them automatically.

Expected output:

- API documentation looks and behaves close to Swagger/Stoplight.
- A ministry audience can see that documentation is generated from formal machine-readable contracts.

## Phase 4: Sandbox Mock APIs

- [ ] Implement mock endpoint handlers for each OpenAPI spec.
- [ ] Add deterministic test records:
  - Valid identity match
  - Identity mismatch
  - Expired document
  - Tax compliant
  - Tax not compliant
  - Business active
  - Business dissolved
  - Permit valid
  - Permit suspended
  - Restricted access
- [ ] Return structured errors with:
  - `requestId`
  - `code`
  - `message`
  - `source`
  - `timestamp`
- [ ] Add response headers for rate limit and correlation ID.
- [ ] Mask sensitive values in server logs.

Expected output:

- A developer can click "try it", send a mock request, and receive realistic government-style responses.
- Failed requests are explainable and audit-friendly.

## Phase 5: Access Management Simulation

- [ ] Create user roles:
  - MDA Developer
  - MDA API Owner
  - Platform Administrator
  - Compliance Reviewer
- [ ] Implement demo login or role switcher.
- [ ] Add API access request form:
  - Consumer MDA
  - Requested API
  - Purpose of access
  - Data fields requested
  - Expected volume
  - Legal basis or service mandate
  - Sandbox or production intent
- [ ] Implement admin approval screen.
- [ ] Generate scoped API keys for approved sandbox access.
- [ ] Enforce access policy on sandbox calls.
- [ ] Show denied responses when the API key is missing, expired, or not scoped to the endpoint.

Expected output:

- Demo can show a clean "request access -> approve -> call API" journey.
- Demo can show unauthorized access being blocked.

## Phase 6: Governance and Compliance Layer

- [ ] Add governance metadata to every API:
  - Data owner
  - Technical owner
  - Personal data categories
  - Purpose limitation
  - Data minimization note
  - Retention class
  - Approval authority
  - Audit requirement
  - Security classification
- [ ] Add a governance tab on each API detail page.
- [ ] Add an access matrix page showing consumer MDA to API permissions.
- [ ] Add a compliance review status badge:
  - Draft
  - Under Review
  - Approved for Sandbox
  - Approved for Production
  - Suspended

Expected output:

- The portal demonstrates that interoperability is governed, not just technically possible.
- A reviewer can explain why a consumer has or does not have access.

## Phase 7: Audit and Monitoring Dashboard

- [ ] Record audit events for:
  - API viewed
  - Access requested
  - Access approved
  - API key generated
  - Sandbox call allowed
  - Sandbox call denied
  - Rate limit exceeded
  - API spec version changed
- [ ] Build dashboard cards:
  - Total API calls
  - Successful calls
  - Denied calls
  - Active API keys
  - Top APIs
  - Top consuming MDAs
- [ ] Build audit log table with filters by MDA, API, event type, and date.
- [ ] Add correlation ID drill-down from a sandbox response to audit event.

Expected output:

- Demo can show oversight: the Ministry can see usage and risk signals.
- Technical teams can trace a request without exposing personal data.

## Phase 8: Demo Polish

- [ ] Add realistic Uganda-specific seed MDAs:
  - Ministry of ICT and National Guidance
  - NITA-U
  - NIRA
  - URA
  - URSB
  - Ministry of Works and Transport
  - Ministry of Health
  - PPDA
  - NSSF
  - Uganda Police Force
- [ ] Add guided demo route or presenter checklist.
- [ ] Add empty, loading, error, and denied-access states.
- [ ] Add accessible labels and keyboard navigation for core flows.
- [ ] Add print-friendly API governance summary.
- [ ] Add one-page executive summary view for leadership.

Expected output:

- The MVP can be presented without explaining implementation details first.
- Screens support both technical and executive audiences.

## Phase 9: Verification

- [ ] Unit test catalog filtering and policy checks.
- [ ] Unit test mock endpoint response scenarios.
- [ ] Unit test API key scoping and expiry rules.
- [ ] End-to-end test:
  - Developer finds NIRA API.
  - Developer requests sandbox access.
  - Admin approves request.
  - Developer calls sandbox endpoint successfully.
  - Developer attempts unauthorized URA endpoint and receives denied response.
  - Admin sees both events in audit log.
- [ ] Run accessibility check on catalog, API detail, access request, and dashboard pages.
- [ ] Run full local demo script from a clean seed database.

Expected output:

- Demo path is repeatable.
- Core security and governance behavior is covered by tests.

## Suggested Milestones

### Milestone 1: Demo Skeleton

Catalog, API details, static OpenAPI docs, and seed data.

### Milestone 2: Interactive Sandbox

Mock endpoints, try-it console, deterministic responses, and error model.

### Milestone 3: Access and Governance

Access requests, approval simulation, scoped API keys, governance metadata, and access matrix.

### Milestone 4: Ministry Demo Pack

Audit dashboard, guided scenarios, executive summary, final README, and repeatable demo script.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Prototype is mistaken for production UGHub replacement | Position as developer portal and sandbox model that complements UGHub |
| Demo appears to expose citizen data | Use mock records, masked identifiers, minimum necessary response fields |
| Scope grows into full national platform | Keep MVP to five mock APIs and one access workflow |
| Governance feels like paperwork | Put governance metadata directly beside API docs and access controls |
| Technical demo fails live | Add deterministic seed data and a guided demo route |

## Definition of Done

- The app starts locally from documented commands.
- Five mock APIs are visible in the catalog.
- At least three APIs have complete OpenAPI docs and sandbox calls.
- Access request and approval workflow works in the UI.
- Unauthorized calls are denied and logged.
- Dashboard shows usage, denied calls, and active access.
- Demo use cases in `docs/ministry-demo-use-cases.md` can be performed end to end.

