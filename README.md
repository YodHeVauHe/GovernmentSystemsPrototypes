# Uganda GovHub API Prototype

Uganda GovHub API is a functional prototype submitted for the **Call to Ugandan Innovators: Government Systems Prototype Showcase and National Innovator Registry** issued by the Ministry of ICT and National Guidance.

The repository now contains one focused prototype: a governed API developer portal and sandbox for Ministries, Departments, and Agencies (MDAs). It is aligned to **Thematic Area 10: Interoperability and Data Exchange**.

## Call Alignment

The Ministry's call seeks practical digital systems that can improve government service delivery, interoperability, citizen engagement, and digital public infrastructure. Uganda GovHub API addresses the interoperability track by demonstrating how government API products can be cataloged, documented, governed, tested, approved, and audited through a single platform.

| Item | Details |
| --- | --- |
| Issuing institution | Ministry of ICT and National Guidance, Republic of Uganda |
| Call | Government Systems Prototype Showcase and National Innovator Registry |
| Thematic area | Area 10: Interoperability and Data Exchange |
| Prototype | Uganda GovHub API |
| Repository scope | Single GovHub prototype in `UgandaGovHubAPI/` |
| Deployment status | Vercel-ready with hosted Postgres configuration |

## Executive Summary

Many government systems operate in silos, which makes it difficult for one MDA to verify identity, tax, business, permit, or eligibility information from another MDA in a controlled and traceable way. Uganda GovHub API demonstrates a secure interoperability layer where approved users can discover government API products, review their governance metadata, request access, test sandbox integrations, and inspect audit evidence.

The prototype uses sandbox data only. It does not connect to live NIRA, URA, URSB, NITA-U, or other production government systems.

![Uganda GovHub API interoperability catalog](./UgandaGovHubAPI/readme-assets/screenshots/apiCatalog.png)

## Functional Scope

Uganda GovHub API includes the following implemented capabilities:

| Capability | Description |
| --- | --- |
| API catalog | Searchable catalog of MDA-owned services with agency, sector, lifecycle, sensitivity, compliance, and access metadata. |
| API detail pages | Service-level governance information, endpoint summaries, access requirements, request examples, response examples, and generated code samples. |
| OpenAPI documentation | Custom documentation pages backed by OpenAPI specifications stored in Postgres and served through `/openapi/*.yaml`. |
| API registration | Admin/API-owner workflow for registering new API products from OpenAPI URLs, uploads, or raw specification text. |
| OpenAPI validation | Validation checks before catalog onboarding, including required metadata and specification integrity feedback. |
| Sandbox runtime | Mock API execution for NIRA-style identity verification, URA-style tax compliance, URSB-style business lookup, driving permit verification, and composite eligibility checks. |
| Access requests | Governed request flow where consumers state purpose, legal basis, environment, data fields, volume tier, and target API. |
| Approval workflow | Dashboard review tools for platform administrators, API owners, and compliance reviewers. |
| Scoped API keys | Sandbox keys tied to approved access, with expiry, revocation, reveal controls, and visibility restrictions. |
| Audit trails | Structured audit events for access requests, approvals, key actions, sandbox calls, account actions, and catalog changes. |
| Analytics dashboard | Oversight views for approved channels, pending approvals, audited traffic, compliance rate, and interoperability matrix state. |
| Account review | Profile, organization, document, security, privilege, notification, and verification-status surfaces for user governance. |
| Security controls | Cookie-backed sessions, MFA support, role-based access control, sensitive-field encryption at rest, TLS/HSTS support, rate limiting, and privacy metadata. |

## Demonstrated Government Workflows

The seeded showcase data demonstrates these interoperability scenarios without using real citizen records:

- NIRA-style national identity verification.
- URA-style tax compliance status checks.
- URSB-style business registration lookup.
- Ministry of Works and Transport-style driving permit verification.
- Composite eligibility checks that combine multiple MDA-style signals.
- API-owner registration of a new service using an OpenAPI specification.
- Administrator and reviewer oversight through approval queues, access matrix views, audit logs, and analytics.

## Technical Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router, and GovHub-specific UI components. |
| Backend | Node.js, Express, TypeScript, and PostgreSQL via `pg`. |
| Persistence | Postgres stores users, sessions, catalog entries, access requests, API keys, audit events, analytics records, and OpenAPI specification text. |
| API contracts | OpenAPI specifications are imported, validated, stored, and exposed for documentation and sandbox behavior. |
| Deployment | Vercel configuration in `UgandaGovHubAPI/vercel.json`, with SPA routing and API routes handled from the same project. |
| Data model | Sandbox-only seeded data designed for demonstration, audit review, and workflow validation. |

## Security and Audit Posture

The prototype is designed to show how government interoperability can be governed rather than treated as unrestricted system-to-system access.

- **Authentication:** Cookie-backed sessions with seeded demo accounts.
- **MFA:** Setup and enforcement support for higher-trust account access.
- **Authorization:** Role-based access control for platform administrators, API owners, compliance reviewers, and developers.
- **Access governance:** Requests capture purpose, statutory basis, data fields, usage tier, environment, and target service.
- **Key management:** API keys are scoped to approved sandbox access and include expiry, revocation, reveal controls, and audit events.
- **Auditability:** Approval actions, key lifecycle actions, sandbox requests, account actions, and catalog changes are logged.
- **Transport security:** TLS/HSTS support is available for hosted or reverse-proxy deployments.
- **Data protection:** Sensitive fields can be encrypted at rest using `GOVHUB_DATA_ENCRYPTION_KEY`; privacy metadata is aligned to Uganda's Data Protection and Privacy Act, 2019.
- **Scope limitation:** No live government integrations, no real citizen data, and no production credential dependencies are included.

Penetration testing and formal security certification have not been completed. The prototype is suitable for showcase review and technical evaluation, not production use without further hardening.

## Repository Structure

```text
UgandaGovHubAPI/
  backend/       Express API, database access, auth, sandbox, catalog, audit, and governance routes
  frontend/      React/Vite portal, catalog, docs, dashboard, settings, and sandbox UI
  readme-assets/ Screenshots used by the repository README files
  vercel.json    Vercel deployment configuration for the full-stack prototype
```

The detailed implementation README is available at [`UgandaGovHubAPI/README.md`](./UgandaGovHubAPI/README.md).

## Local Demonstration

Run the prototype locally from the project directory:

```bash
cd UgandaGovHubAPI
npm run install:all
npm run dev
```

For local development, `npm run dev` starts the local Postgres container when needed, seeds the showcase data, and starts the frontend and backend. The backend defaults to `http://127.0.0.1:4000`; the frontend URL is printed by Vite.

Useful project checks that remain aligned with the current repository contents:

```bash
npm run lint
npm run build
```

Demo accounts, environment variables, security configuration, and the presenter path are documented in [`UgandaGovHubAPI/README.md`](./UgandaGovHubAPI/README.md).

## Vercel Deployment

The deployable application lives in the `UgandaGovHubAPI` subdirectory. When importing this repository into Vercel:

1. Set **Root Directory** to `UgandaGovHubAPI`.
2. Use the build and routing configuration from `UgandaGovHubAPI/vercel.json`.
3. Configure hosted Postgres through `DATABASE_URL` or supported Vercel Postgres variables.
4. Set `GOVHUB_TRUST_TLS_TERMINATION=true`.
5. Add the required demo account credentials and allowed origins described in `UgandaGovHubAPI/README.md`.
6. Deploy, then seed the hosted Postgres database once for showcase data.

`VITE_API_BASE_URL` can be omitted for same-origin Vercel routing.

## Audit Notes

This repository is intentionally limited to the GovHub interoperability prototype. Reviewers should evaluate it as a working showcase system that demonstrates:

- Functional delivery of the interoperability and data exchange thematic area.
- Practical MDA API discovery, access governance, sandbox testing, and oversight workflows.
- Technical implementation across frontend, backend, database, OpenAPI handling, and deployment configuration.
- Security-aware controls appropriate for a prototype, with clear production limitations.

The system should not be represented as connected to live production government infrastructure. All seeded workflows and service responses are mock/sandbox data for demonstration and evaluation.
