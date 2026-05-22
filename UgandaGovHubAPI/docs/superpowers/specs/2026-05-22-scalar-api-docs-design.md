# Scalar API Docs Design

## Goal

Add a shareable API documentation area for all registered MDA APIs using Scalar-style OpenAPI rendering. Users must be able to open `/docs`, choose an API, and link directly to an API's documentation at `/docs/:apiId`. Documentation visibility must be configurable so each API can be public, authenticated, or restricted.

## Recommended Approach

Use a lightweight docs index at `/docs` and a per-API Scalar reference page at `/docs/:apiId`.

This is more efficient and secure than one combined multi-API reference because the index loads only catalog metadata, each Scalar page loads one OpenAPI document on demand, and access decisions can be enforced per API. It also gives every MDA API a stable URL for sharing and audit logging.

## Routes

- `/docs`: documentation index listing APIs the current visitor may view.
- `/docs/:apiId`: Scalar-rendered OpenAPI documentation for one API.
- Existing `/api/:id` API detail page can keep its governance and sandbox workflow, but its technical documentation tab should use or link to the same Scalar docs experience for consistency.

## Visibility Model

Each API gets a documentation visibility setting:

- `public`: visible to visitors without sign-in.
- `authenticated`: visible only to signed-in approved users.
- `restricted`: visible only to platform administrators, compliance reviewers, owning MDA API owners, and consumers with approved access for that API.

If an API has no explicit docs visibility yet, the default should be conservative:

- `Public` API access level defaults to `public`.
- `Restricted` API access level defaults to `authenticated`.
- `Private` API access level defaults to `restricted`.

## Backend

Add API docs metadata and authorization helpers:

- Extend catalog API responses with `docs_visibility`.
- Add `GET /api/docs`, returning only APIs visible to the current visitor.
- Add `GET /api/docs/:id`, returning API metadata and the active OpenAPI spec URL only when the visitor can view docs.
- Keep serving static OpenAPI files at `/openapi`, but do not rely on hiding static files as the only security control. The docs route should only disclose restricted spec URLs to authorized users.
- Add tests for the visibility matrix across anonymous users, developers, API owners, reviewers, and admins.

## Frontend

Add a docs section:

- Add `DocsPage` for `/docs`.
- Add `ApiDocsPage` for `/docs/:apiId`.
- Use `@scalar/api-reference-react` on the per-API page with a single `url` configuration pointing to the allowed OpenAPI URL.
- Configure Scalar for the GovHub dark UI, single-document loading, downloads enabled where allowed, and the interactive test request button hidden or disabled unless the API is sandbox-enabled and the user is approved.
- Add “API Docs” to the sidebar navigation.

## Access Groups

Expose access groups for easy review:

- Add a sidebar or settings entry for “Access Groups”.
- Show the current user's access group and permissions from the existing account privilege summary.
- In docs pages, show who can view the current API documentation based on `docs_visibility`.
- Admins and owning API owners should be able to edit docs visibility as part of API settings.

## Error Handling

- Anonymous users opening restricted docs see a sign-in prompt or 401 state.
- Approved but unauthorized users see a clear 403 state explaining that the docs are restricted.
- Missing APIs or missing OpenAPI files show a 404 state.
- Invalid OpenAPI specs show a Scalar load failure plus a download link only if the user is authorized.

## Testing

- Backend unit tests cover visibility decisions and docs endpoints.
- Frontend build verifies routing and Scalar imports.
- Manual verification covers `/docs`, `/docs/:apiId`, sidebar navigation, and one restricted API scenario.
