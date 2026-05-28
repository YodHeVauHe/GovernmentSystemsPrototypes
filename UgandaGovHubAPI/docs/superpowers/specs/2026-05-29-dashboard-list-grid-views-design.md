# Dashboard List and Grid Views Design

## Scope

Add independent list/grid presentation modes to the Dashboard tabs for Access Approvals, Audit Trails, and Interoperability Matrix. The existing API Catalog view switch is the interaction model to match: a compact two-button segmented control with grid and list icons, per-surface state, and no global side effects.

The change stays in the frontend dashboard. It does not change API fetching, permissions, filtering, approval flows, audit data shape, matrix data shape, or catalog behavior.

## Architecture

`frontend/src/dashboard/page.tsx` owns the dashboard data and tab rendering today, so it remains the implementation boundary. Add three independent React state values:

- `approvalViewMode: 'list' | 'grid'`
- `auditViewMode: 'list' | 'grid'`
- `matrixViewMode: 'list' | 'grid'`

Each defaults to `list`, matching the catalog page's default. The existing `accountViewMode` remains unchanged.

Use small helper UI where it reduces repetition, such as a local view toggle component that accepts `value`, `onChange`, and aria labels. It should reuse the same Tabler icons already imported by the dashboard: `IconGridDots` and `IconList`.

## Components and Layout

### Access Approvals

The list view remains the current table. The grid view renders one card per `visibleRequests` item with:

- consumer MDA
- requested API
- lawful basis
- purpose
- fields and volume tier
- status badge
- the same approval, expiry, revoke, and delete controls used by the list row

Empty state copy remains equivalent to the existing table empty state.

### Audit Trails

The list view remains the current table and keeps row click selection behavior. The grid view renders one card per `visibleLogs` item with:

- event type badge
- timestamp
- consumer
- registry target
- request/correlation identifier
- inspect action that selects the log, matching the table row behavior

The grid must preserve denied, allowed, and neutral event coloring.

### Interoperability Matrix

The list view remains the current matrix table. The grid view renders one card per consumer MDA from `mdas`. Each card shows:

- MDA name and short name
- approved registry channel count
- one compact status row or chip per matrix API target
- clear active/inactive visual treatment using the existing green check and muted inactive mark

The same matrix membership check used by the table drives the grid view.

## Data Flow

All new views consume existing derived data:

- Access Approvals uses `visibleRequests`.
- Audit Trails uses `visibleLogs`.
- Matrix uses `mdas` and `matrix`.

The dashboard search query and current filters continue to apply before rendering. Toggling a view mode only changes presentation and should not refetch data or mutate records.

## Error Handling

No new network calls are introduced. Existing dashboard loading and error states remain unchanged and continue to wrap all tab content. Empty states should render in both list and grid modes when filtered data is empty.

## Testing

Add focused tests if the existing frontend test setup supports rendering this dashboard surface without heavy auth/router setup. At minimum, run the frontend build or TypeScript check to verify the JSX and state changes. Manual browser verification should confirm:

- each of the three tabs has its own independent view toggle
- toggling one tab does not affect the others
- existing approval/key actions remain available in Access Approvals grid view
- audit grid cards still select logs for inspection
- matrix grid cards represent the same access state as the table
