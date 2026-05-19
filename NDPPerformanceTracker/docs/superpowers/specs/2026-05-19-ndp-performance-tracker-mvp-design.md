# NDP Performance Tracker MVP Design

Date: 2026-05-19

## Purpose

Build a government-facing MVP of the NDP Performance Tracker: a full-stack Monitoring and Evaluation dashboard for executive oversight of Uganda National Development Plan programme performance.

The demo must show more than static charts. It must demonstrate role-based access, national budget and delivery oversight, map-based investigation, programme and district drill-downs, controlled milestone updates, and a briefing-ready report view.

## Audience

The MVP will be presented to government officials, programme managers, and technical evaluators. The primary story is executive oversight, with enough operational and technical depth to show that the system can become a real M&E platform.

## Scope

The MVP will emphasize:

- Budget accountability: allocation, expenditure, absorption rate, and underperforming districts.
- Delivery performance: milestone completion, delayed milestones, bottlenecks, and programme risk.
- Role-scoped access: Executives see national scope; Program Managers see assigned programmes.
- Map-first investigation: MapCN-based district markers for budget, delivery, and risk.
- Core actions: login, filter, map click, drill down, update milestone status, and generate a briefing view.

Out of scope:

- Production authentication.
- Real integrations with government systems.
- CSV/XLSX import UI.
- Administrative data entry screens beyond controlled milestone status/note updates.
- Notifications, audit trails, and full national district coverage.
- District polygon choropleths. The MVP will use district centroid markers.

The backend data model and seed process must leave room for future CSV/XLSX import.

## Architecture

Use the existing intended folder split:

- `frontend/`: React + Vite dashboard app.
- `backend/`: Express API, SQLite database, seed scripts, and data access code.

The frontend must call backend API endpoints. It must not import dashboard data directly from local mock files.

SQLite will run locally under `backend/`. Seed data and data access logic will be kept separate from route handlers so future import services can write into the same tables without changing the dashboard API contract.

## shadcn/ui Dashboard Components

Use the local shadcn/ui source reference from `opensrc/repos/github.com/shadcn-ui/ui`.

Primary reference block:

- `opensrc/repos/github.com/shadcn-ui/ui/apps/v4/registry/new-york-v4/blocks/dashboard-01`

The MVP should adapt the `dashboard-01` component structure instead of inventing a dashboard shell from scratch:

- `page.tsx` layout pattern: `SidebarProvider`, `AppSidebar`, `SidebarInset`, `SiteHeader`, section cards, chart area, and data table.
- `components/app-sidebar.tsx`: sidebar navigation structure, adapted to NDP sections.
- `components/site-header.tsx`: compact page header with sidebar trigger and current view title.
- `components/section-cards.tsx`: KPI card pattern, adapted for allocation, expenditure, absorption, delivery, high-risk districts, and delayed milestones.
- `components/chart-area-interactive.tsx`: Recharts + shadcn chart pattern, adapted for budget vs expenditure and milestone trends.
- `components/data-table.tsx`: TanStack table pattern, adapted for programme portfolio, district comparison, milestone lists, and briefing tables.

Supporting shadcn/ui primitives should come from the same local source style where applicable:

- `card`
- `badge`
- `button`
- `chart`
- `select`
- `toggle-group`
- `tabs`
- `table`
- `dropdown-menu`
- `sidebar`
- `separator`
- `input`
- `drawer` or `sheet` for map/district side panels

The shadcn dashboard block is a reference and component source, not a final product. Labels, icons, data fields, table columns, chart series, and navigation must be rewritten for NDP Monitoring and Evaluation. Demo-only controls from the source block, such as generic "Add Section" or irrelevant document labels, must be removed or replaced with meaningful NDP actions.

## MapCN Usage

Use the local MapCN reference from `opensrc/repos/github.com/AnmolSaini16/mapcn`.

Relevant MapCN components:

- `Map`
- `MapMarker`
- `MarkerTooltip`
- `MarkerContent`
- `MapControls`

The MVP should use MapCN's core `map` component pattern rather than copying an entire example block unchanged. The `analytics-map` example is the closest reference because it combines summary overlays with geographic markers and tooltips.

Map behavior:

- Center on Uganda.
- Render 8-12 district centroid markers.
- Show marker status using visual severity states for normal, watch, and high risk.
- Tooltip or side panel should show district name, absorption rate, delayed milestones, active programmes, and risk reason.
- Provide toggles for budget absorption, milestone delivery, high-risk districts, and delayed programme activity.

Basemap note:

MapCN's defaults use CARTO basemap URLs. For the MVP, configure the map explicitly with a MapLibre-compatible basemap. Online basemap usage is acceptable for demo speed, but the implementation should not hide that dependency.

## Screens And Flow

### 1. Role Login

Provide predefined demo users:

- Executive user: national visibility.
- Program Manager user: limited to assigned programmes.

Login returns a demo user context or token used by backend endpoints for authorization decisions.

### 2. National Executive Command Dashboard

Default landing page for Executive users.

Content:

- National NDP performance score.
- Total allocation, total expenditure, and absorption rate.
- Milestone completion rate and delayed milestone count.
- High-risk districts requiring intervention.
- MapCN Uganda map with district performance markers.
- Budget vs expenditure visualization.
- Delivery status breakdown.
- Priority programme ranking.
- District comparison table.
- Requires Attention panel for delayed or underperforming items.

Dashboard composition must use the adapted shadcn `dashboard-01` pattern:

- KPI cards from the section-card pattern.
- Interactive chart card from the chart-area pattern.
- Programme and district tables from the data-table pattern.
- Sidebar/header shell from the dashboard layout pattern.

The first 60 seconds of the demo should clearly answer:

- Are funds being absorbed responsibly?
- Are programmes delivering on schedule?
- Which districts require intervention?

### 3. Budget And Delivery Map View

Dedicated geospatial oversight page.

Controls:

- Budget absorption layer.
- Milestone delivery layer.
- High-risk district layer.
- Delayed programme activity layer.
- Programme, district, reporting period, and risk-level filters.

Interactions:

- Clicking a marker opens a district performance summary or navigates to the District Performance View.
- Filters must update the map from backend data.

### 4. Programme Portfolio View

List visible programmes with:

- Responsible ministry or agency.
- Budget allocation.
- Expenditure.
- Absorption rate.
- Milestone completion.
- District coverage.
- Risk level.

Executives see all programmes. Program Managers see assigned programmes only.

### 5. Programme Detail View

Show one programme's:

- Budget utilization.
- District-level performance.
- Milestone timeline.
- Delayed milestones and bottlenecks.
- Responsible ministry or agency.
- Latest reporting period.
- Filtered map of districts where the programme is active.

Executives can open any programme. Program Managers can open assigned programmes only.

### 6. District Performance View

Show one district's:

- Visible programmes.
- Budget absorption.
- Completed and delayed milestones.
- Risk notes.
- Comparative rank.
- Programme bottlenecks driving district risk.

For Program Managers, district data must be filtered to their assigned programmes.

### 7. Reports / Briefing View

Provide a meeting-ready summary page:

- Headline KPIs.
- Top risks.
- Underperforming districts.
- Delayed programmes.
- Budget and delivery summary.
- Recommended intervention areas.

Export is out of scope for MVP, but the screen should look suitable for presenting in a meeting.

## Core Demonstrable Functionality

The MVP must support these demo actions:

1. Login as Executive and Program Manager to show different data scope.
2. Filter dashboard data by programme, district, reporting period, and risk level.
3. Use the map to investigate district budget and delivery performance.
4. Drill down from national dashboard to programme detail.
5. Drill down from national dashboard to district detail.
6. Update a milestone status and note as an authorized user. The MVP will not support editing programme budgets, district records, or milestone definitions.
7. Return to the dashboard and see summaries reflect the updated milestone.
8. Open a briefing report based on current stored data.

## Data Model

Core tables:

- `users`: demo users with role and display name.
- `roles`: Executive and Program Manager.
- `programs`: national programmes with responsible ministry or agency.
- `districts`: Ugandan districts with centroid latitude and longitude.
- `user_programs`: Program Manager assignment table.
- `budgets`: programme, district, allocation, expenditure, absorption rate, and reporting period.
- `milestones`: programme milestones with district, planned date, status, completion date, delay state, and note.
- `performance_snapshots`: stored or computed district/programme summary metrics for dashboard queries.
- `risk_flags`: executive alerts such as low absorption, delayed milestones, or mismatch between spending and delivery.

Seed data:

- 3 national programmes.
- 8-12 Ugandan districts.
- Mixed performance cases: high-performing, delayed, low-absorption, and high-risk districts.

Suggested programmes:

- Parish Development Model implementation.
- Rural Roads / Infrastructure delivery.
- Health Facility Upgrade programme.

Every seeded district must have coordinates, budget data, milestone data, and at least one meaningful status or risk signal.

## Permissions

Executive:

- Can access all programmes, all districts, national summaries, map markers, portfolio rankings, programme details, district details, milestone updates, and briefing reports.

Program Manager:

- Can access assigned programmes only.
- Dashboard, maps, programme list, district detail, and briefing data are filtered by assignment.
- Cannot access unassigned programme detail.
- Can update milestone status and notes for assigned programmes only.

Backend query logic must enforce role scoping. Frontend-only filtering is not sufficient.

## API

Required endpoints:

- `POST /api/auth/login`: login as a predefined demo user.
- `GET /api/me`: return current user and role.
- `GET /api/dashboard/summary`: scoped KPIs with optional programme, district, reporting period, and risk filters.
- `GET /api/map/district-performance`: scoped district marker data with layer/filter parameters.
- `GET /api/programs`: visible programme portfolio.
- `GET /api/programs/:id`: programme detail if authorized.
- `GET /api/districts/:id`: district profile filtered by visible programmes.
- `PATCH /api/milestones/:id`: update milestone status and note if authorized. Budget values, district records, and milestone definitions are not editable through this endpoint.
- `GET /api/reports/briefing`: briefing-ready summary based on current data and filters.

Expected errors:

- `401`: no demo user context.
- `403`: user requests data outside their role scope.
- `404`: entity does not exist.
- `500`: unexpected backend failure.

When a milestone is updated, dashboard and report queries must reflect the new milestone state from persisted backend data.

## Frontend Behavior

The frontend should feel like an internal government command center: dense, clear, official, and built for scanning.

The dashboard UI should follow shadcn/ui `new-york-v4` conventions from the local source reference. Use the dashboard block's spacing, sidebar behavior, card structure, tabs, table controls, and chart container patterns, but keep the visual language restrained and official for government use.

Required states:

- Loading states for dashboard, map, detail pages, and update actions.
- Empty states for filters that return no data.
- Unauthorized state with clear wording, such as "This programme is outside your assigned portfolio."
- Error state for backend failures.

Navigation:

- Login routes into the correct role landing page.
- Executive lands on National Executive Command Dashboard.
- Program Manager lands on a scoped programme/dashboard view.
- Dashboard cards, tables, and map markers support drill-down navigation.

## Testing

Backend tests:

- Demo login.
- Role scoping.
- Dashboard summary filters.
- Programme authorization.
- District map data filtering.
- Milestone update authorization and persistence.
- Briefing report reflects current data.

Seed data checks:

- Every programme has budgets and milestones.
- Every district has coordinates.
- Every map marker has meaningful budget and delivery metrics.
- At least one clear risk case exists for the demo story.

Frontend smoke tests:

- Login as Executive.
- Login as Program Manager.
- Executive dashboard loads.
- Map markers render.
- Marker interaction works.
- Programme drill-down works.
- District drill-down works.
- Milestone update changes visible summaries.
- Briefing view loads.

## Demo Readiness Criteria

The MVP is demo-ready when:

- The app runs locally with documented commands for `frontend/` and `backend/`.
- The database can be reset and reseeded reliably.
- Demo users are documented.
- Core demo path has no blank charts, empty maps, broken navigation, or dead-end buttons.
- Backend role restrictions are visible and enforced.
- MapCN map loads with Uganda district markers and useful tooltips.
- Milestone updates persist and affect dashboard/report summaries.
- The briefing view is suitable for presenting to officials.
