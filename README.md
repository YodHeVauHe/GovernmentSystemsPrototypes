# Uganda Government Systems Prototype Showcase

This workspace contains functional prototypes created for the **Call to Ugandan Innovators: Government Systems Prototype Showcase and National Innovator Registry** issued by the Ministry of ICT and National Guidance.

## Call Context

The Ministry is seeking Ugandan technology innovators who can build practical digital systems for government service delivery, interoperability, citizen engagement, and digital public infrastructure.

- **Issued by:** Ministry of ICT and National Guidance, Republic of Uganda
- **Submission deadline:** 1 June 2026, 23:59 EAT
- **Submission portal:** [gdr.ict.go.ug/innovators-showcase](https://gdr.ict.go.ug/innovators-showcase)

The core objectives are to identify capable local innovators, establish the Uganda National Innovator Registry, shortlist deployable prototypes, and promote Ugandan-built digital public infrastructure.

## Prototypes

### 1. [UgCitizen Resolve Portal](./UgCitizenResolvePortal/)

**Thematic Area 11: Citizen Engagement and Service Delivery**

UgCitizen Resolve Portal is a citizen reporting and complaint-management prototype. It lets citizens submit local service issues with location and evidence, while giving government responders a triage dashboard for assignment, status updates, and resolution tracking.

**Progress:** In progress. The core concept and local prototype structure are present, but this project is not yet at the same deployment-readiness level as Uganda GovHub API.

### 2. [Uganda GovHub API](./UgandaGovHubAPI/)

**Thematic Area 10: Interoperability and Data Exchange**

![Uganda GovHub API interoperability catalog](./UgandaGovHubAPI/docs/architecture-pdf/assets/apiCatalog.png)

Uganda GovHub API is a developer portal and sandbox for governed MDA data exchange. It includes an API catalog, OpenAPI documentation pages, mock sandbox APIs, access request approvals, scoped sandbox API keys, audit logging, analytics, account review, MFA, role-based access control, encryption-at-rest support, and TLS/HSTS configuration.

The GovHub prototype uses sandbox data only. It demonstrates NIRA-style identity verification, URA-style tax compliance, URSB-style business lookup, driving permit verification, and composite eligibility workflows without connecting to live government production systems.

**Progress:** Deployment-ready for Vercel when imported with `UgandaGovHubAPI` as the Vercel project root and a hosted Postgres database configured.

## Project Progress

| Prototype | Status | Notes |
| --- | --- | --- |
| Uganda GovHub API | Deployment-ready | Full-stack Vite, Express, and Postgres prototype with Vercel configuration in `UgandaGovHubAPI/vercel.json`. |
| UgCitizen Resolve Portal | In progress | Functional prototype direction is present, but it still needs final deployment hardening and readiness checks. |

## Vercel Deployment From This Repository

This GitHub repository is a two-project workspace. Vercel will initially see the repository root, `GovermentSystemsPrototypes`, but Uganda GovHub API must be deployed from the `UgandaGovHubAPI` subdirectory.

In Vercel, import the GitHub repository, then open the project configuration before deploying:

1. Set **Root Directory** to `UgandaGovHubAPI`.
2. Keep the build settings from `UgandaGovHubAPI/vercel.json`.
3. Add the required environment variables from `UgandaGovHubAPI/README.md`, including `DATABASE_URL`, `GOVHUB_TRUST_TLS_TERMINATION=true`, and the demo account credentials.
4. Deploy the project, then seed the hosted Postgres database once for the showcase catalog data.

If the import screen does not show the root directory selector, create the Vercel project first, then go to **Project Settings -> General -> Root Directory**, set it to `UgandaGovHubAPI`, save, and redeploy.

## How To Run

Each prototype has its own `README.md` with setup, demo accounts, and presenter guidance.

For Uganda GovHub API:

```bash
cd UgandaGovHubAPI
npm run install:all
npm run seed
npm run dev
```

For UgCitizen Resolve Portal, open its project folder and follow the local README instructions.

## Positioning

These prototypes are showcase systems. They are intended to demonstrate user experience, workflow design, technical architecture, security posture, and practical delivery capability. They do not contain real citizen data and should not be described as connected to live production government systems.
