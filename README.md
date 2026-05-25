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

### 2. [Uganda GovHub API](./UgandaGovHubAPI/)

**Thematic Area 10: Interoperability and Data Exchange**

Uganda GovHub API is a developer portal and sandbox for governed MDA data exchange. It includes an API catalog, OpenAPI documentation pages, mock sandbox APIs, access request approvals, scoped sandbox API keys, audit logging, analytics, account review, MFA, role-based access control, encryption-at-rest support, and TLS/HSTS configuration.

The GovHub prototype uses sandbox data only. It demonstrates NIRA-style identity verification, URA-style tax compliance, URSB-style business lookup, driving permit verification, and composite eligibility workflows without connecting to live government production systems.

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
