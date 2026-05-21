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

## Core Demo Flow

### 1. Discover Government APIs

The presenter opens the Interoperability Catalog and shows the available API products:

- NIRA Identity Verification API
- URA Tax Compliance Status API
- URSB Business Registration Lookup
- MoWT Driving Permit Verification API
- Service Uganda Composite Eligibility

The key message is that MDAs can discover standard, documented services from one place instead of relying on informal integrations.

### 2. Inspect Governance Metadata

The presenter opens an API detail view and highlights:

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

### 3. Request Access

As a developer from MoH, the presenter requests access to an API and provides:

- Business purpose
- Legal basis
- Requested fields
- Environment
- Volume tier

The key message is that access requests must be explicit, purposeful, and reviewable.

### 4. Review and Approve

As an API owner or MoICT reviewer, the presenter reviews pending access requests and approves or denies them. Approved requests create controlled access channels and can issue sandbox credentials.

The key message is that each data-owning MDA remains accountable for access to its datasets.

### 5. Demonstrate the Interoperability Matrix

The presenter opens the interoperability matrix to show which consuming MDAs have approved access to which source APIs.

The key message is that MoICT can see the active government data-sharing map across agencies.

### 6. Inspect Audit Logs

The presenter opens audit logs and shows platform events such as:

- Access requested
- Access approved or denied
- API registered
- Sandbox activity

The key message is that GovHub provides traceability for policy, security, and compliance oversight.

### 7. Register a New API

As a MoICT admin, the presenter uses the Add API flow to validate an OpenAPI specification, capture governance metadata, and register the API into the catalog.

The key message is that new ministry APIs can be onboarded through a standardized validation and governance process.

## Recommended Live Demo Script

1. Start as a MoH developer and open the catalog.
2. Search for NIRA Identity Verification API.
3. Open the API detail view and explain the statutory basis and data minimization controls.
4. Submit an access request for service eligibility verification.
5. Switch to API owner or reviewer mode.
6. Approve the pending request.
7. Open the interoperability matrix and show the new approved channel.
8. Open audit logs and show the event trail.
9. Switch to admin mode and register a draft API from an OpenAPI specification.

## Success Criteria

The demo is successful when the audience can see:

- A single catalog of government APIs across MDAs.
- Clear ownership and statutory basis for each API.
- A governed request and approval process.
- A visible matrix of approved data-sharing channels.
- Audit logs for accountability.
- A repeatable onboarding process for new ministry APIs.

## Positioning for Ministry Stakeholders

Uganda GovHub API is a digital public infrastructure prototype for secure data exchange. It helps MoICT demonstrate how ministries can move from siloed, manual verification to governed, auditable, API-based service delivery.
