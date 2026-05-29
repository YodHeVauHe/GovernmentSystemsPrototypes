# Uganda GovHub API Prototype Showcase

This repository contains functional prototypes created for the **Call to Ugandan Innovators: Government Systems Prototype Showcase and National Innovator Registry** issued by the Ministry of ICT and National Guidance.

## Call Context

The Ministry is seeking Ugandan technology innovators who can build practical digital systems for government service delivery, interoperability, citizen engagement, and digital public infrastructure.

- **Issued by:** Ministry of ICT and National Guidance, Republic of Uganda
- **Submission deadline:** 1 June 2026, 23:59 EAT
- **Submission portal:** [gdr.ict.go.ug/innovators-showcase](https://gdr.ict.go.ug/innovators-showcase)

The core objectives are to identify capable local innovators, establish the Uganda National Innovator Registry, shortlist deployable prototypes, and promote Ugandan-built digital public infrastructure.

## Prototypes

### [Uganda GovHub API](./UgandaGovHubAPI/)

**Thematic Area 10: Interoperability and Data Exchange**

![Uganda GovHub API interoperability catalog](./UgandaGovHubAPI/docs/architecture-pdf/assets/apiCatalog.png)

Uganda GovHub API is a developer portal and sandbox for governed MDA data exchange. It includes an API catalog, OpenAPI documentation pages, mock sandbox APIs, access request approvals, scoped sandbox API keys, audit logging, analytics, account review, MFA, role-based access control, encryption-at-rest support, and TLS/HSTS configuration.

The GovHub prototype uses sandbox data only. It demonstrates NIRA-style identity verification, URA-style tax compliance, URSB-style business lookup, driving permit verification, and composite eligibility workflows without connecting to live government production systems.

**Progress:** Deployment-ready for Vercel when imported with `UgandaGovHubAPI` as the Vercel project root and a hosted Postgres database configured.

### [BlockChainDemo](./BlockChainDemo/)

**Thematic Area: Digital Public Infrastructure / Government Records Verification**

BlockChainDemo is a browser-based Vite React prototype that teaches blockchain concepts through a Uganda government land-title workflow. It covers hashes, blocks, linked chains, distributed MDA peers, asset tokens, and a concrete land-title verification and transfer use case.

The demo positions blockchain as a permissioned government verification layer rather than cryptocurrency. It shows how Ministries, Departments, and Agencies can hold matching proofs of important actions, detect tampering, sequence approvals, and audit land-title transfer history without replacing source MDA systems.

**Progress:** Browser-only prototype ready for local demonstration from `BlockChainDemo/frontend`.

## Project Progress

| Prototype | Status | Notes |
| --- | --- | --- |
| Uganda GovHub API | Deployment-ready | Full-stack Vite, Express, and Postgres prototype with Vercel configuration in `UgandaGovHubAPI/vercel.json`. |
| BlockChainDemo | Demo-ready | Vite React frontend that demonstrates permissioned blockchain concepts through land-title verification and transfer workflows. |

## Vercel Deployment From This Repository

This GitHub repository contains multiple prototypes. The deployable GovHub app lives in the `UgandaGovHubAPI` subdirectory, so Vercel should use that folder as the project root for that project.

In Vercel, import the GitHub repository, then open the project configuration before deploying:

1. Set **Root Directory** to `UgandaGovHubAPI`.
2. Keep the build settings from `UgandaGovHubAPI/vercel.json`.
3. Add the required environment variables from `UgandaGovHubAPI/README.md`, including `DATABASE_URL`, `GOVHUB_TRUST_TLS_TERMINATION=true`, and the demo account credentials.
4. Deploy the project, then seed the hosted Postgres database once for the showcase catalog data.

If the import screen does not show the root directory selector, create the Vercel project first, then go to **Project Settings -> General -> Root Directory**, set it to `UgandaGovHubAPI`, save, and redeploy.

## How To Run

The Uganda GovHub API project README contains the full setup, demo accounts, security configuration, deployment notes, and presenter path. For local setup:

```bash
cd UgandaGovHubAPI
npm run install:all
npm run seed
npm run dev
```

The BlockChainDemo project README contains the concept walkthrough and local checks. For local setup:

```bash
cd BlockChainDemo/frontend
npm install
npm run dev
```

## Positioning

These prototypes are showcase systems. They are intended to demonstrate user experience, workflow design, technical architecture, security posture, and practical delivery capability. They do not contain real citizen data and should not be described as connected to live production government systems.
