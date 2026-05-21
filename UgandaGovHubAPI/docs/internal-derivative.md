# Uganda GovHub API Internal Derivative

## Purpose

Uganda GovHub API is an MVP developer portal and sandbox that demonstrates how Ugandan Ministries, Departments, and Agencies (MDAs) could discover, request access to, test, and govern interoperable government APIs through a single trusted experience.

The product model should feel familiar to teams that have used Swagger UI or Stoplight: searchable API catalog, OpenAPI-driven documentation, interactive request/response testing, mock servers, schema examples, and governance metadata. The Ugandan adaptation is the important differentiator: every API is framed around MDA ownership, lawful data sharing, access purpose, auditability, and alignment with national interoperability efforts.

## Strategic Fit

This prototype should be presented as a developer-facing model that complements Uganda's existing digital government infrastructure, especially UGHub. It should not claim to replace UGHub.

Relevant public context:

- NITA-U describes UGHub as a systems and data integration platform for secure, rational, efficient, and sustainable data sharing across government systems. It is built on WSO2 and hosted in the Government of Uganda data centre.
- NITA-U states that UGHub provides API management capabilities for entities to create, share, consume, and control access to APIs.
- The Ministry of ICT and National Guidance leads strategic ICT policy, coordination, and digital transformation across government.
- Uganda's Digital Transformation Roadmap emphasizes digital services, interoperability, cyber security, data protection, and privacy.
- The e-Government Interoperability Framework Reference Architecture (GIRA) and e-GIF direction are meant to reduce fragmentation and improve information exchange between MDAs.
- Uganda's Data Protection and Privacy Act, 2019 governs collection, processing, use, disclosure, and protection of personal data.

Source references:

- https://nita.go.ug/ughub
- https://www.nita.go.ug/services/e-government-services/integration-service-ughub
- https://ict.go.ug/about-us/overview
- https://ict.go.ug/programs/digital-transformation
- https://ict.go.ug/resources/documents/strategies-and-frameworks
- https://ict.go.ug/wp-content/uploads/2023/08/Digital-Transformation-Roadmap.pdf
- https://ulii.org/akn/ug/act/2019/9/eng@2019-05-03

## Product Thesis

UGHub solves the national integration platform problem. Uganda GovHub API demonstrates the developer and governance layer that makes such integration understandable, testable, auditable, and easier to adopt by MDAs.

The MVP should answer five ministry-level questions:

1. What government APIs exist, and which MDA owns each one?
2. What data does each API expose, and for what lawful purpose?
3. How can an authorized technical team test integration safely before production access?
4. Who has access to which endpoint, and under which approval?
5. Can the Ministry see usage, failures, and suspicious access patterns?

## Target Users

### Ministry Leadership

Needs a clear story: reduced duplication, faster service delivery, better oversight, secure data sharing, and measurable adoption.

### NITA-U / Platform Administrators

Need controls for API onboarding, access approvals, API key lifecycle, versioning, usage monitoring, audit logs, and governance metadata.

### MDA API Owners

Need a place to publish API documentation, schemas, sample requests, response examples, sandbox rules, uptime status, and access conditions.

### MDA Developers

Need a portal where they can search APIs, read docs, try mock endpoints, generate sample requests, request access, and understand errors.

### Compliance / Data Protection Reviewers

Need visibility into personal data categories, lawful processing basis, retention expectations, access approvals, and audit history.

## MVP Scope

### Must Have

- API catalog organized by MDA, sector, data sensitivity, and API lifecycle status.
- OpenAPI-based documentation for core mock government APIs.
- Interactive "try it" console against sandbox mock endpoints.
- API key request and approval simulation.
- Role-based views for developer, MDA owner, and platform administrator.
- Access matrix showing which agency can access which dataset.
- Audit log showing key issuance, endpoint calls, denied requests, and admin changes.
- Governance fields for data owner, legal basis, data sensitivity, retention class, and approval status.
- Demo dashboard showing usage volume, error rates, popular APIs, and denied requests.

### Should Have

- Mock data profiles for successful, failed, expired, mismatch, and restricted access scenarios.
- Version selector for APIs.
- Downloadable OpenAPI JSON/YAML.
- Code snippets for cURL, JavaScript, Python, and Java.
- API health and mock uptime indicators.
- Request correlation IDs for audit traceability.
- Rate limit and quota display per consumer agency.

### Not In MVP

- Real citizen data.
- Direct connection to production NIRA, URA, URSB, Uganda Police, immigration, or transport systems.
- Real payment processing.
- Production-grade identity federation.
- Replacement of UGHub, WSO2, or existing NITA-U integration infrastructure.

## API Catalog Model

Each API in the catalog should include:

- API name
- Owning MDA
- Business purpose
- Endpoint group
- OpenAPI spec version
- Data sensitivity level
- Personal data categories
- Required approval authority
- Legal or policy basis
- Sandbox availability
- Production access status
- Rate limit tier
- SLA target
- Contact office
- Audit retention period

## Initial Mock APIs

### NIRA Identity Verification

Endpoint examples:

- `POST /api/v1/identity/verify-nin`
- `GET /api/v1/identity/status/{nin}`

Demo value: Shows how an MDA can verify a citizen identity without photocopies or manual letters.

Data protection stance: Return minimum necessary data. Use match confidence and verification status instead of exposing full citizen records by default.

### URA Tax Compliance Status

Endpoint examples:

- `POST /api/v1/tax/tin-status`
- `GET /api/v1/tax/clearance/{tin}`

Demo value: Shows procurement, licensing, and grant workflows checking tax compliance directly.

Data protection stance: Return status, issuing authority, validity window, and reference ID instead of detailed tax history.

### URSB Business Registration Lookup

Endpoint examples:

- `GET /api/v1/business/registration/{brn}`
- `POST /api/v1/business/beneficial-ownership/verify`

Demo value: Shows agency onboarding and due diligence for companies applying for government services.

Data protection stance: Separate public company facts from restricted beneficial ownership data.

### Driving Permit Verification

Endpoint examples:

- `POST /api/v1/transport/driving-permit/verify`
- `GET /api/v1/transport/driving-permit/status/{permitNumber}`

Demo value: Shows verification for driver recruitment, enforcement, and service eligibility.

Data protection stance: Return permit class, validity, and status, not full personal profile.

### Service Uganda Centre Composite Eligibility

Endpoint examples:

- `POST /api/v1/service-uganda/eligibility-check`

Demo value: Shows how a front-office service centre could call multiple back-office APIs through one workflow while retaining audit traceability.

Data protection stance: Composite responses should explain which source authority produced each decision.

## Governance Model

The prototype should make governance visible in the interface, not hidden in policy documents.

Recommended governance fields:

- Data owner MDA
- API technical owner
- Data processor or controller role
- Personal data involved
- Purpose limitation statement
- Consent or statutory authority basis
- Retention class
- Access approval level
- Sandbox-only or production eligible
- Security classification
- Audit logging requirement

## Security Model

The MVP should simulate these controls:

- API keys scoped by consumer agency and endpoint.
- Per-endpoint authorization checks.
- Rate limits by agency and API.
- Request IDs for every sandbox call.
- Audit logs for successful and denied calls.
- Masked personal data in logs.
- Admin approval workflow for API access requests.
- Environment separation between sandbox and production.

Production hardening would later add OAuth 2.1 / OpenID Connect, mutual TLS, hardware-backed secrets, identity federation, signing, centralized SIEM integration, formal data sharing agreements, and full compliance review.

## User Experience Principles

- Make APIs discoverable by government service problem, not only by technical endpoint.
- Make ownership obvious: every endpoint must show the responsible MDA.
- Keep interactive docs close to Swagger UI expectations: endpoint list, schemas, parameters, examples, response codes, and try-it console.
- Include Stoplight-style design governance: reusable schemas, examples, linting expectations, versioning, and approval status.
- Treat governance as first-class metadata beside the technical docs.
- Avoid exposing unnecessary personal data in examples.

## MVP Success Criteria

The MVP is successful if a ministry demo can show:

- A developer finding a government API in under 30 seconds.
- A developer running a sandbox call and seeing a realistic response.
- An administrator approving API access for an MDA.
- A denied request when an agency tries to access an unauthorized endpoint.
- A dashboard showing usage, failures, and access events.
- A governance view explaining who owns the API, what data it exposes, and why access is allowed.

