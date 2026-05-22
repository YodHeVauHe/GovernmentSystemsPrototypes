# Uganda GovHub API: Interoperability & Data Exchange

## Thematic Area
**Area 10: Interoperability & Data Exchange** (Government API platforms, data integration middleware, GovHub)

## The Problem
Currently, many Ugandan Government systems operate in isolated silos. When a citizen interacts with one agency, that agency often cannot easily verify data held by another (e.g., verifying a NIRA National ID, checking a URA Tax Clearance, or confirming a driving permit). This lack of interoperability leads to massive inefficiencies, forcing citizens to physically carry paper documents between ministries and creating opportunities for fraud. The Ministry of ICT and National Guidance recognizes that a modern digital government requires a secure, unified middleware layer to facilitate data exchange between MDAs.

## The Solution
**Uganda GovHub API** is a developer portal and API gateway prototype demonstrating how government systems can securely share data.

The prototype includes:
1. **Developer Portal:** A clean, accessible documentation site (similar to Swagger or Stoplight) detailing available mock Government APIs (e.g., `/api/v1/verify-nin`, `/api/v1/tax-status`).
2. **Sandbox Environment:** A testing environment where authorized developers from different MDAs can test API integrations using mock data without exposing real citizen records.
3. **Access Management:** A conceptual demonstration of API key provisioning, showing how the Ministry can monitor and control which agency has access to which datasets.

This solution proves the capability to build the foundational digital public infrastructure (DPI) required for all other e-government services to function efficiently.

## Local Demo

Install dependencies:

```bash
npm run install:all
```

Seed the local SQLite database:

```bash
npm run seed
```

Start the full demo:

```bash
npm run dev
```

The frontend runs on the Vite dev-server URL shown in the terminal. The backend sandbox API defaults to `http://127.0.0.1:4000`.

Useful scripts:

```bash
npm run lint
npm run build
npm test
npm run demo
```

Demo accounts are seeded automatically:

| Role | Email | Password |
| --- | --- | --- |
| Platform admin | `admin@ict.go.ug` | `AdminPass123!` |
| MDA developer | `demo.developer@govhub.go.ug` | `DemoDeveloper123!` |
| NIRA API owner | `demo.api.owner@nira.go.ug` | `DemoApiOwner123!` |
| Compliance reviewer | `demo.reviewer@govhub.go.ug` | `DemoReviewer123!` |

## Presenter Path

1. Log in as the MDA developer and search the catalog for identity, tax, business, permit, or composite services.
2. Open an API detail page, review governance metadata, and submit a sandbox access request.
3. Log in as the platform admin or NIRA API owner and approve the access request from the dashboard.
4. Return to the API detail page and run a sandbox request with the approved key.
5. Open the dashboard audit log, analytics, and access matrix to show oversight and traceability.
