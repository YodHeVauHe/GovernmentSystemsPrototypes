# Dashboard List and Grid Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent list/grid views to Dashboard Access Approvals, Audit Trails, and Interoperability Matrix tabs.

**Architecture:** Keep the dashboard data fetching and permissions in `DashboardPage`. Add a small tested helper module for reusable presentation decisions, then wire per-tab view state and grid JSX into `frontend/src/dashboard/page.tsx`. The current table views remain the list views.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS classes, Tabler icons, Node assertion tests.

---

### Task 1: Dashboard View Helper Module

**Files:**
- Create: `frontend/src/dashboard/view-helpers.test.ts`
- Create: `frontend/src/dashboard/view-helpers.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/dashboard/view-helpers.test.ts`:

```ts
import assert from 'assert/strict';
import {
  MATRIX_TARGETS,
  buildMatrixChannelRows,
  getAuditEventTone,
  getRequestStatusLabel,
  isMatrixChannelActive,
} from './view-helpers.ts';

const matrix = [
  { consumer_mda_id: 'mda-01', api_id: 'api-nira-01' },
  { consumer_mda_id: 'mda-01', api_id: 'api-ura-01' },
  { consumer_mda_id: 'mda-02', api_id: 'api-ursb-01' },
];

assert.equal(getAuditEventTone('SANDBOX_CALL_DENIED'), 'denied');
assert.equal(getAuditEventTone('SANDBOX_CALL_ALLOWED'), 'allowed');
assert.equal(getAuditEventTone('ACCESS_APPROVED'), 'neutral');

assert.equal(getRequestStatusLabel({ status: 'PENDING' }), 'PENDING');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'ACTIVE' }), 'ACTIVE');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'REVOKED' }), 'REVOKED');

assert.equal(isMatrixChannelActive(matrix, 'mda-01', 'api-nira-01'), true);
assert.equal(isMatrixChannelActive(matrix, 'mda-01', 'api-ursb-01'), false);

assert.deepEqual(
  buildMatrixChannelRows(matrix, 'mda-01').map(row => [row.apiId, row.label, row.active]),
  MATRIX_TARGETS.map(target => [target.apiId, target.label, target.apiId === 'api-nira-01' || target.apiId === 'api-ura-01'])
);

console.log('dashboard view helper tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node frontend/src/dashboard/view-helpers.test.ts`

Expected: FAIL with module not found for `./view-helpers.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/dashboard/view-helpers.ts`:

```ts
export type ViewMode = 'list' | 'grid';

export type AuditEventTone = 'denied' | 'allowed' | 'neutral';

export type MatrixTarget = {
  apiId: string;
  label: string;
};

export const MATRIX_TARGETS: MatrixTarget[] = [
  { apiId: 'api-nira-01', label: 'NIRA Identity' },
  { apiId: 'api-ura-01', label: 'URA Tax Clearance' },
  { apiId: 'api-ursb-01', label: 'URSB Registry' },
  { apiId: 'api-mowt-01', label: 'MoWT Transport' },
  { apiId: 'api-moict-01', label: 'MoICT Composite' },
];

export function getAuditEventTone(eventType: string): AuditEventTone {
  if (eventType.includes('DENIED')) return 'denied';
  if (eventType.includes('ALLOWED')) return 'allowed';
  return 'neutral';
}

export function getRequestStatusLabel(request: { status?: string; api_key_status?: string | null }) {
  return request.status === 'APPROVED'
    ? request.api_key_status || 'ACTIVE'
    : request.status || 'PENDING';
}

export function isMatrixChannelActive(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  apiId: string
) {
  return matrix.some(row => row.consumer_mda_id === consumerMdaId && row.api_id === apiId);
}

export function buildMatrixChannelRows(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  targets = MATRIX_TARGETS
) {
  return targets.map(target => ({
    ...target,
    active: isMatrixChannelActive(matrix, consumerMdaId, target.apiId),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node frontend/src/dashboard/view-helpers.test.ts`

Expected: PASS and prints `dashboard view helper tests passed`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/view-helpers.ts frontend/src/dashboard/view-helpers.test.ts
git commit -m "test: add dashboard view helpers"
```

### Task 2: Independent View Mode State and Toggle UI

**Files:**
- Modify: `frontend/src/dashboard/page.tsx`

- [ ] **Step 1: Add imports and view state**

Modify `frontend/src/dashboard/page.tsx`:

```ts
import {
  MATRIX_TARGETS,
  buildMatrixChannelRows,
  getAuditEventTone,
  getRequestStatusLabel,
  type ViewMode,
} from './view-helpers';
```

Add state near the existing `accountViewMode` state:

```ts
const [approvalViewMode, setApprovalViewMode] = useState<ViewMode>('list');
const [auditViewMode, setAuditViewMode] = useState<ViewMode>('list');
const [matrixViewMode, setMatrixViewMode] = useState<ViewMode>('list');
```

- [ ] **Step 2: Add local toggle component**

Add this helper before `DashboardPage`:

```tsx
function ViewModeToggle({
  value,
  onChange,
  gridLabel,
  listLabel,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
  gridLabel: string;
  listLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-1">
      <button
        type="button"
        aria-label={gridLabel}
        onClick={() => onChange('grid')}
        className={`rounded-[6px] p-1.5 transition-all ${value === 'grid' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
      >
        <IconGridDots className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={listLabel}
        onClick={() => onChange('list')}
        className={`rounded-[6px] p-1.5 transition-all ${value === 'list' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'}`}
      >
        <IconList className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS. This step may still show no UI changes because the toggle is not yet placed in headers.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/dashboard/page.tsx
git commit -m "feat: add dashboard view mode state"
```

### Task 3: Access Approvals Grid View

**Files:**
- Modify: `frontend/src/dashboard/page.tsx`

- [ ] **Step 1: Add the Access Approvals toggle to the header**

In the Access Approvals header, replace the single-title header content with a responsive header containing:

```tsx
<div className="p-4 border-b border-[#2e2e2e] bg-[#141414] flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
  <div>
    <h2 className="text-[15px] font-semibold text-white">Active Access Requests</h2>
    <p className="text-[12px] text-[#8b8b8b] mt-0.5">Evaluate legal mandate alignment and manage cryptographically bound sandbox API keys.</p>
  </div>
  <ViewModeToggle
    value={approvalViewMode}
    onChange={setApprovalViewMode}
    gridLabel="Show access approvals grid view"
    listLabel="Show access approvals list view"
  />
</div>
```

- [ ] **Step 2: Preserve the current table as list view**

Wrap the current Access Approvals `<div className="min-h-0 flex-1 overflow-auto">` table container in an `approvalViewMode === 'list'` branch. Put the grid branch from Step 3 in the `false` branch:

```tsx
{approvalViewMode === 'list' ? (
  <div className="min-h-0 flex-1 overflow-auto">
    <Table className="min-w-[1060px]">
      ...current Access Approvals table header and rows...
    </Table>
  </div>
) : (
  <div className="min-h-0 flex-1 overflow-y-auto p-4">
    ...Access Approvals grid JSX from Step 3...
  </div>
)}
```

- [ ] **Step 3: Add the Access Approvals grid JSX**

Use this grid content in the grid branch:

```tsx
{visibleRequests.length === 0 ? (
  <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
    No access requests found matching your agency permissions.
  </div>
) : (
  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    {visibleRequests.map(req => (
      <div key={req.id} className="flex min-h-[300px] flex-col rounded-lg border border-[#2e2e2e] bg-[#181818] p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#8b8b8b]">{req.mda_name}</div>
            <h3 className="mt-1 truncate text-[15px] font-semibold text-white" title={req.api_name}>{req.api_name}</h3>
          </div>
          <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase
            ${req.status === 'APPROVED' && (req.api_key_status || 'ACTIVE') === 'ACTIVE' ? 'border-[#3ecf8e]/20 bg-[#3ecf8e]/5 text-[#3ecf8e]' :
              req.status === 'APPROVED' ? 'border-red-400/20 bg-red-400/5 text-red-300' :
              'border-orange-400/20 bg-orange-400/5 text-orange-400'}
          `}>
            {getRequestStatusLabel(req)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
          <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
            <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Lawful Basis</div>
            <div className="mt-1 text-[#ededed]">"{req.legal_basis || 'Not Provided'}"</div>
          </div>
          <div className="rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
            <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Fields & Tier</div>
            <div className="mt-1 font-mono text-[#ededed]">{req.volume_tier || 'Low'}</div>
            <div className="mt-0.5 line-clamp-1 text-[#8b8b8b]" title={req.requested_fields}>{req.requested_fields || 'All'}</div>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-[#2e2e2e] bg-[#141414] p-3 text-[12px]">
          <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Purpose</div>
          <p className="mt-1 line-clamp-2 leading-5 text-[#ededed]" title={req.purpose}>{req.purpose}</p>
        </div>
        <div className="mt-auto border-t border-[#2e2e2e] pt-4">
          {req.status === 'PENDING' ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ExpiryDatePicker
                value={keyExpiryInputs[req.id] ?? toDateTimeLocalValue()}
                onChange={value => setKeyExpiryInputs(current => ({ ...current, [req.id]: value }))}
              />
              <button
                onClick={() => handleApprove(req.id)}
                disabled={approving === req.id}
                className="h-[28px] rounded-md bg-[#3ecf8e] px-3 text-[12px] font-semibold text-black transition-all hover:bg-[#3ecf8e]/95 disabled:opacity-50"
              >
                {approving === req.id ? 'Approving...' : 'Approve key'}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-[12px] text-[#8b8b8b]">
                {req.api_key_preview || 'Key deleted'}
              </span>
              {req.api_key_preview && (
                <div className="flex items-center gap-1.5">
                  <ExpiryDatePicker
                    value={keyExpiryInputs[req.id] ?? toDateTimeLocalValue(req.api_key_expires_at)}
                    onChange={value => setKeyExpiryInputs(current => ({ ...current, [req.id]: value }))}
                    onApply={() => handleUpdateExpiry(req.id)}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="API key actions"
                        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#2e2e2e] text-[#8b8b8b] transition-colors hover:bg-[#2e2e2e] hover:text-white"
                      >
                        <IconDotsVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 border-[#2e2e2e] bg-[#1c1c1c] text-[#ededed]">
                      <DropdownMenuItem
                        onClick={() => openKeyActionConfirmation('revoke', req)}
                        className="flex cursor-pointer items-center gap-2 text-[12px] text-orange-300 focus:bg-orange-400/10 focus:text-orange-200"
                      >
                        <IconBan className="h-3.5 w-3.5" />
                        Revoke key
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openKeyActionConfirmation('delete', req)}
                        className="flex cursor-pointer items-center gap-2 text-[12px] text-red-300 focus:bg-red-400/10 focus:text-red-200"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                        Delete key
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/page.tsx
git commit -m "feat: add access approvals grid view"
```

### Task 4: Audit Trails Grid View

**Files:**
- Modify: `frontend/src/dashboard/page.tsx`

- [ ] **Step 1: Add the Audit Trails toggle to the header**

Keep the existing time range and consumer filters. Add:

```tsx
<ViewModeToggle
  value={auditViewMode}
  onChange={setAuditViewMode}
  gridLabel="Show audit trails grid view"
  listLabel="Show audit trails list view"
/>
```

Place it beside the existing audit filters in the header controls.

- [ ] **Step 2: Replace inline audit tone booleans with helper**

Inside `visibleLogs.map`, replace `isDenied` and `isAllowed` calculations with:

```ts
const eventTone = getAuditEventTone(log.event_type);
```

Use:

```tsx
${eventTone === 'denied' ? 'text-red-400 border-red-400/20 bg-red-400/5' :
  eventTone === 'allowed' ? 'text-[#3ecf8e] border-[#3ecf8e]/20 bg-[#3ecf8e]/5' :
  'text-blue-400 border-blue-400/20 bg-blue-400/5'}
```

- [ ] **Step 3: Preserve the current table as list view and add grid branch**

Wrap the audit table container in `auditViewMode === 'list' ? (...) : (...)`.

Use this grid branch:

```tsx
<div className="min-h-0 flex-1 overflow-y-auto p-4">
  {visibleLogs.length === 0 ? (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
      No compliance audit entries recorded.
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {visibleLogs.map(log => {
        const eventTone = getAuditEventTone(log.event_type);

        return (
          <button
            key={log.id}
            type="button"
            onClick={() => setSelectedLog(log)}
            className={`rounded-lg border p-4 text-left transition-colors hover:bg-[#202020] ${
              selectedLog?.id === log.id ? 'border-[#3ecf8e]/40 bg-[#202020]' : 'border-[#2e2e2e] bg-[#181818]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase
                ${eventTone === 'denied' ? 'border-red-400/20 bg-red-400/5 text-red-400' :
                  eventTone === 'allowed' ? 'border-[#3ecf8e]/20 bg-[#3ecf8e]/5 text-[#3ecf8e]' :
                  'border-blue-400/20 bg-blue-400/5 text-blue-400'}
              `}>
                {log.event_type}
              </span>
              <span className="font-mono text-[11px] text-[#8b8b8b]">{new Date(log.created_at).toLocaleTimeString()}</span>
            </div>
            <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
              <div>
                <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Consumer</div>
                <div className="mt-1 font-medium text-white">{log.mda_name || 'ANONYMOUS'}</div>
              </div>
              <div>
                <div className="font-mono uppercase tracking-wide text-[#8b8b8b]">Registry Target</div>
                <div className="mt-1 text-[#ededed]">{log.api_name || 'SYSTEM'}</div>
              </div>
            </div>
            <div className="mt-4 rounded-md border border-[#2e2e2e] bg-[#141414] p-3">
              <div className="font-mono text-[10px] uppercase tracking-wide text-[#8b8b8b]">Correlation ID</div>
              <div className="mt-1 truncate font-mono text-[12px] text-[#ededed]" title={log.request_id || log.correlation_id}>
                {log.request_id || log.correlation_id || 'Unavailable'}
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 font-mono text-[12.5px] text-[#3ecf8e]">
              Inspect
              <IconExternalLink className="h-3.5 w-3.5" />
            </div>
          </button>
        );
      })}
    </div>
  )}
</div>
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/page.tsx
git commit -m "feat: add audit trails grid view"
```

### Task 5: Interoperability Matrix Grid View

**Files:**
- Modify: `frontend/src/dashboard/page.tsx`

- [ ] **Step 1: Add Matrix header controls**

Replace the plain matrix heading block with a responsive header that includes:

```tsx
<ViewModeToggle
  value={matrixViewMode}
  onChange={setMatrixViewMode}
  gridLabel="Show interoperability matrix grid view"
  listLabel="Show interoperability matrix list view"
/>
```

- [ ] **Step 2: Use shared matrix target metadata for the table**

Replace hard-coded matrix column labels and per-cell checks with `MATRIX_TARGETS.map(...)`, keeping the same table visuals.

- [ ] **Step 3: Add matrix grid branch**

Wrap the matrix table in `matrixViewMode === 'list' ? (...) : (...)`.

Use this grid branch:

```tsx
<div className="min-h-0 flex-1 overflow-y-auto">
  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
    {mdas.map(consumer => {
      const channels = buildMatrixChannelRows(matrix, consumer.id);
      const activeCount = channels.filter(channel => channel.active).length;

      return (
        <div key={consumer.id} className="rounded-lg border border-[#2e2e2e] bg-[#181818] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-white">{consumer.name}</h3>
              <div className="mt-1 font-mono text-[12px] text-[#8b8b8b]">{consumer.shortName}</div>
            </div>
            <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/5 px-2.5 py-0.5 font-mono text-[11px] text-[#3ecf8e]">
              {activeCount}/{channels.length} active
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {channels.map(channel => (
              <div key={channel.apiId} className="flex items-center justify-between gap-3 rounded-md border border-[#2e2e2e] bg-[#141414] px-3 py-2">
                <span className="min-w-0 truncate text-[12.5px] text-[#ededed]">{channel.label}</span>
                {channel.active ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase text-[#3ecf8e]">
                    <IconCircleCheck className="h-4 w-4" stroke={1.8} />
                    Active
                  </span>
                ) : (
                  <span className="font-mono text-[11px] uppercase text-[#555]">Inactive</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/dashboard/page.tsx
git commit -m "feat: add matrix grid view"
```

### Task 6: Final Verification

**Files:**
- Verify: `frontend/src/dashboard/page.tsx`
- Verify: `frontend/src/dashboard/view-helpers.ts`
- Verify: `frontend/src/dashboard/view-helpers.test.ts`

- [ ] **Step 1: Run helper tests**

Run: `node frontend/src/dashboard/view-helpers.test.ts`

Expected: PASS and prints `dashboard view helper tests passed`.

- [ ] **Step 2: Run frontend build**

Run: `npm run build`

Expected: PASS with TypeScript and Vite completing successfully.

- [ ] **Step 3: Start local dev server**

Run: `npm run dev:frontend -- --host 127.0.0.1 --port 5173`

Expected: Vite starts and serves the frontend at `http://127.0.0.1:5173/`.

- [ ] **Step 4: Browser smoke check**

Open `http://127.0.0.1:5173/dashboard` and confirm:

- Access Approvals can switch list/grid without changing Audit Trails or Matrix modes.
- Audit Trails can switch list/grid without changing Access Approvals or Matrix modes.
- Interoperability Matrix can switch list/grid without changing Access Approvals or Audit Trails modes.
- Existing table/list views still render.
- Grid views render cards with no overlapping text.

- [ ] **Step 5: Commit any final fixes**

```bash
git add frontend/src/dashboard/page.tsx frontend/src/dashboard/view-helpers.ts frontend/src/dashboard/view-helpers.test.ts
git commit -m "fix: polish dashboard view toggles"
```
