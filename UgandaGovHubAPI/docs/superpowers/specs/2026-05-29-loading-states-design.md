# Loading States Design

## Scope

Replace true loading states that currently show plain loading copy with shaped loading UI. Data-fetch and page-load surfaces use skeleton layouts that match the target component shape. Short async actions use the existing shadcn `Spinner`.

## Surfaces

- App auth/session gates: centered shell loading state with spinner.
- Catalog/docs/account/API detail/dashboard data loads: skeletons that preserve the surrounding page layout.
- Inline actions: validate/register API, sandbox request, document upload, and similar buttons use `Spinner`.
- Error and empty states keep explanatory text because they are not loading states.

## Components

Use the existing shadcn primitives:

- `Spinner` from `frontend/src/components/ui/spinner.tsx`.
- `Skeleton` from `frontend/src/components/ui/skeleton.tsx`.

Add small local skeleton helpers near the pages they represent when the shape is page-specific. Avoid a broad new loading framework unless repeated patterns emerge.

## Verification

Run frontend tests and a production build. Manually inspect the loading replacements in changed files for plain `Loading...` text and non-shadcn spinner icons.
