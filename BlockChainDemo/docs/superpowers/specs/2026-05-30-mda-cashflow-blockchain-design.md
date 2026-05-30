# MDA Cashflow Blockchain Design

## Purpose

Add an `MDA Cashflow` concept page to BlockChainDemo that shows how a permissioned blockchain can make public-sector cash movement auditable across ministries, departments, and agencies.

The feature will use cashflow as the shared data stream because every MDA budget, release, commitment, payment, and reconciliation event touches money. The blockchain does not replace IFMIS, procurement systems, bank rails, or accounting tools. It acts as a tamper-evident audit layer that records signed checkpoints from those systems and makes accountability rules visible.

## User Experience

The page will fit the existing dark app shell and shadcn sidebar. A new navigation item named `MDA Cashflow` will appear alongside the existing blockchain concepts.

The page will present a single realistic flow:

1. Parliament or Treasury allocates budget to an MDA and budget line.
2. Treasury releases part of the allocation.
3. The MDA creates a commitment against released funds.
4. An authorized officer approves payment.
5. A bank or payment gateway confirms disbursement.
6. Reconciliation confirms that the payment matched the approved obligation.

The page will include a compact executive summary, an event timeline, a ledger table, and an accountability panel that explains detected risks such as overspending, duplicate references, missing approvals, or reconciliation mismatches.

## Domain Model

Create a focused cashflow module under `frontend/src/lib/cashflow.ts`.

Core event types:

- `BudgetAllocated`
- `FundsReleased`
- `CommitmentCreated`
- `PaymentApproved`
- `BankDisbursed`
- `Reconciled`

Each event will include:

- `id`
- `type`
- `mda`
- `budgetLine`
- `amount`
- `currency`
- `actor`
- `reference`
- `timestamp`
- `previousHash`
- `hash`
- `metadata`

The hash will be derived from a canonical event payload plus the previous event hash. This keeps the demonstration aligned with the existing blockchain/hash lessons and makes tampering visible.

## Validation Rules

The module will compute rule results from sample ledger data:

- Released funds cannot exceed allocated budget for the same MDA and budget line.
- Commitments cannot exceed released funds.
- Bank disbursement must be preceded by payment approval for the same reference.
- Reconciliation must match a known disbursement amount.
- Duplicate payment or disbursement references are flagged.
- Any broken hash link marks the chain as tampered.

Rules will return structured findings with severity, title, description, and the related event ids. The UI will display those findings without embedding business logic in React components.

## Architecture

New files:

- `frontend/src/lib/cashflow.ts`: types, sample ledger builder, hash chaining, summaries, and validation.
- `frontend/src/lib/cashflow.test.ts`: unit tests for hashing and accountability rules.
- `frontend/src/pages/CashflowPage.tsx`: page composition and presentation.

Changed files:

- `frontend/src/App.tsx`: route the new concept page.
- `frontend/src/components/layout/ConceptNav.tsx`: add the sidebar item.
- `frontend/src/App.test.tsx`: update navigation expectations and page switching coverage.

The React page will consume precomputed data from the library layer. It should not mutate the ledger or duplicate validation rules.

## Error Handling

This is a static demonstration, so runtime errors should be avoided by deterministic sample data and typed helper functions. Validation functions will handle empty ledgers and missing references by returning findings instead of throwing. Hash helpers will use the existing crypto utilities where practical to keep behavior consistent.

## Testing

Unit tests will cover:

- Stable hash generation for chained cashflow events.
- Tamper detection when a prior event changes.
- Over-release and over-commit detection.
- Duplicate payment or disbursement reference detection.
- Missing approval before bank disbursement.
- Reconciliation amount mismatch.

App tests will cover:

- The new sidebar item renders.
- Selecting `MDA Cashflow` displays the new page.

Verification before completion:

- `npm run typecheck`
- `npm test -- --run src/lib/cashflow.test.ts src/App.test.tsx`
- `npm run build`

## Scope

In scope:

- One educational, realistic cashflow scenario.
- Deterministic sample data.
- Rule-based accountability findings.
- Dark-theme UI consistent with the current app.

Out of scope:

- Real IFMIS, bank, or procurement integrations.
- Authentication, permissions, or live APIs.
- Persisted user-edited ledgers.
- A production smart-contract implementation.

## Implementation Notes

Prefer existing UI primitives and page patterns over new abstractions. Keep the cashflow module pure and testable. Add enough data to make the flow credible, but keep the page readable as a learning/demo surface.
