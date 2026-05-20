# MVP Implementation Plan: UgCitizen Resolve Portal (Divided Architecture)

This document outlines the engineering architecture and development roadmap for building the **UgCitizen Resolve Portal** MVP using a divided directory structure: `frontend/` and `backend/`.

---

## 1. Interface & Folder Architecture

The MVP is organized into two primary directories to reflect a production-grade divided architecture:

```
UgCitizenResolvePortal/
├── docs/                      # Technical specifications and plans
├── frontend/                  # Client-side static assets
│   ├── index.html             # UI containing Citizen, Triage and API Inspector panels
│   ├── styles.css             # Glassmorphic CSS styling
│   └── app.js                 # Frontend event handlers and maps
└── backend/                   # Node.js backend server
    ├── package.json           # Node configuration and dependencies
    ├── database.json          # Simple file database storing state
    └── server.js              # Express app simulating Portal and Agency APIs
```

### Interface Panels (3-in-1 Dashboard)
1.  **Citizen Portal (Left Panel)**: Allows citizens to submit geolocated complaints under the categories `BROKEN_INFRASTRUCTURE`, `WATER_LEAK`, or `PUBLIC_SERVICE_FAILURE`. Requires NIN verification.
2.  **Government Triage Dashboard (Center Panel)**: Map and list of reported issues for MDA triage officers. Allows assigning response teams and entering resolution remarks to mark issues as `"Resolved"`.
3.  **Live API Console (Right Panel)**: Displays real-time API request and response JSON logs communicating with the backend endpoints (e.g. `api.nira.go.ug` identity check, `api.sms.go.ug` notifications, and direct MDA dispatches).

---

## 2. Backend & Mock Database Engine (`backend/`)

The backend runs on Node.js + Express (port `3000`). It maintains a persistent state using `backend/database.json`.

### Mock Schema Entities
-   `citizens`: Demographic records for NIRA identity verification.
-   `reports`: Citizen complaints, tracking numbers, status transitions, and resolution remarks.
-   `api_logs`: Audit records of integration transactions to feed the real-time API console.

### Status Transitions
As specified by the project requirements, reports must transition through exactly three states:
1.  **Received**: Initial state upon submission. A notification is sent to the citizen with their `tracking_number`.
2.  **In Progress**: Set when an administrative agent assigns a `assigned_team` to the report.
3.  **Resolved**: Set when the agent inputs `resolution_remarks`. An SMS notification is triggered to update the citizen with the resolution.

---

## 3. Dev Setup & Milestones

### Milestone 1: Setup Backend and Database (Step 1)
*   Create `backend/package.json` and install dependencies.
*   Initialize `backend/database.json` with pre-filled mock records.
*   Build `backend/server.js` exposing API routes for `/api/v1/reports`, `/api/v1/admin/reports`, `/api/nira/v1/verify`, `/api/sms/v1/send`, and `/api/v1/admin/logs`.

### Milestone 2: Build Frontend Application (Step 2)
*   Implement `frontend/index.html` structure with three columns.
*   Apply premium glassmorphic styling in `frontend/styles.css` with transitions.
*   Implement map markers and form interaction inside `frontend/app.js` using `fetch` calls to the local Node backend.

### Milestone 3: Run and E2E Verify (Step 3)
*   Start the backend using `npm run start` or `node backend/server.js`.
*   Verify end-to-end flow using the interactive walkthrough widget.
