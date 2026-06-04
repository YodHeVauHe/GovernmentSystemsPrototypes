# Product Tour Design

## Scope

Add a short in-app product usage guide for approved signed-in users. The guide is a spotlight-led walkthrough that helps new users perform the most important first actions in the real GovHub UI, then remains available on demand from the header and Help page.

The tour is personalized by account role and current access. It must not show steps for pages or controls the account cannot use. The first version covers these role paths:

- `developer`: open the catalog, inspect an API, request access, copy or understand approved credentials, then review sandbox/API call activity.
- `api_owner`: register or manage an API, review access requests, inspect documentation visibility, then review relevant audit activity.
- `admin`: verify accounts, review access requests, inspect governance audit trails, then inspect the interoperability matrix.
- `reviewer`: inspect governance audit trails, review access-decision evidence, then inspect the interoperability matrix.

The tour is not a training library, help-center replacement, or long onboarding wizard. Each role path should stay at 3-4 high-value steps.

## Architecture

Use a frontend tour provider inside `AppShell`, after session loading and route guards have resolved. The provider derives the active tour path from `useUser()` values: authenticated user, approval status, role, MDA, and MFA state. It should only activate for approved users who can access the protected shell. Pending users continue to use the existing account status and verification flow.

The tour renderer is a small custom React component built from existing UI primitives, not a large third-party tour dependency. It renders:

- a dimmed page overlay
- a focused spotlight around the current target when the target exists
- a compact callout with step count, title, instruction, primary action, skip, close, and back/next controls where useful
- a small progress rail so the user understands how short the tour is

Route navigation is part of the tour. A step may navigate the user to `/catalog`, `/api/:id`, `/dashboard`, `/catalog/add`, `/docs`, `/account/settings`, or `/help` before focusing its target. If a target is not available after route changes or data loading, the callout falls back to a centered instruction with a recovery action instead of blocking the page.

## Backend Persistence

Store progress per account so first-run state follows the user across sessions and devices. Add a dedicated `user_onboarding_progress` table through the same `ensure*Schema` pattern used elsewhere:

- `user_id TEXT NOT NULL`
- `tour_id TEXT NOT NULL`
- `completed_step_ids TEXT NOT NULL DEFAULT '[]'`
- `dismissed_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ`
- `last_step_id TEXT`
- `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- primary key on `(user_id, tour_id)`
- foreign key to `users(id)`

Use these known tour IDs for validation and progress records:

- `developer-start-guide`
- `api-owner-start-guide`
- `admin-start-guide`
- `reviewer-start-guide`

Expose authenticated endpoints under `/api/onboarding`:

- `GET /api/onboarding/progress` returns progress for the current user and role-relevant tour IDs.
- `PATCH /api/onboarding/progress/:tourId` updates completed steps, last step, dismissed state, or completed state for the current user only.
- `POST /api/onboarding/progress/:tourId/restart` clears dismissed/completed state for the current user and starts the tour again.

Inputs must validate `tourId`, `stepId`, and array sizes. The backend should ignore or reject tour IDs that are not known by the product, and it must never allow one user to update another user's progress.

## Frontend Integration

Add a tour module under `frontend/src/onboarding/` with focused responsibilities:

- `tour-definitions.ts`: role-specific tour definitions and route targets.
- `tour-targets.ts`: stable target IDs used by UI elements through `data-tour-target`.
- `OnboardingProvider.tsx`: progress fetching, active-tour state, route coordination, and backend updates.
- `ProductTour.tsx`: overlay, spotlight measurement, callout controls, and keyboard handling.
- `onboarding-api.ts`: typed API helpers.

Wire `OnboardingProvider` around protected shell content in `AppShell`. Add a compact `Start guide` trigger to `SiteHeader` for signed-in approved users. Add the same action to `HelpPage` so the tour can be launched on demand after first use. The first-run prompt should not appear on public routes, auth routes, pending account status, or mandatory MFA setup.

Existing product surfaces should expose stable tour targets with minimal markup changes:

- sidebar navigation items for Catalog, Docs, Dashboard, Settings, and Help
- catalog search/filter area and representative API card/detail actions
- request access action on API detail
- dashboard role tabs and key panels
- add API entry point for API owners
- account review and access approval surfaces for admins
- audit and matrix surfaces for reviewers/admins

Tour definitions filter steps at runtime when a target or permission is unavailable. For example, a developer without an approved key should see a credential explanation step, not a copy-key step that cannot succeed.

## Interaction Behavior

The tour should teach by letting users act:

- Primary actions should navigate to the real page or ask the user to click the actual highlighted control.
- Steps should auto-advance when the app can observe completion, such as reaching the target route or opening the expected surface.
- Users can skip an individual step, dismiss the tour, restart it later, or finish it.
- Dismissed first-run tours should not reopen automatically, but the on-demand `Start guide` action must always be available.
- Keyboard users can move through callout controls, press Escape to close, and continue using the underlying app when the tour is dismissed.

The copy must stay direct and operational. Avoid policy background, long explanations, or duplicate help text already present on the page.

## Error Handling

If progress fetching fails, the app should still render normally and allow a same-session tour using local state. Persisted updates can retry opportunistically, but failed progress writes must not block product actions.

If a tour target is missing because data has not loaded, the provider waits briefly and then shows a fallback callout. If a target is missing because the user's role cannot access it, the step is filtered out. If all role steps are filtered out, `Start guide` should open Help instead of an empty tour.

Backend validation errors should return clear 400 responses. Unauthenticated progress calls return 401 through existing auth middleware.

## Testing

Add focused tests for tour-definition filtering, progress payload validation, and user-scoped progress updates. Frontend verification should cover:

- first-run tour appears for an approved user and does not appear for unauthenticated, pending, or mandatory-MFA users
- developer, API owner, admin, and reviewer accounts receive different visible steps
- unavailable steps are filtered instead of shown disabled
- `Start guide` launches the tour after dismissal or completion
- progress is fetched and saved per account
- missing targets fall back without breaking the page

Run the relevant frontend and backend checks after implementation. Manual browser verification should include desktop and mobile widths because spotlight placement must avoid covering the highlighted control or overflowing the viewport.
