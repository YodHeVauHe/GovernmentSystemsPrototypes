# Full Vercel Deployment Design

## Goal

Deploy the full Uganda GovHub app on Vercel while preserving the existing local development workflow:

```bash
npm run db:up
npm run seed
npm run dev
```

The production deployment should run the Vite frontend and Express API in one Vercel project, backed by Postgres for all persistent data.

## Current Shape

- The frontend is a Vite React app in `frontend/`.
- The backend is an Express TypeScript app in `backend/`.
- The backend uses Postgres through `backend/src/db.ts`.
- Local development starts the backend as a long-running server on port `4000`.
- OpenAPI specs are still runtime files under `backend/openapi/`.
- The frontend reads `VITE_API_BASE_URL` and falls back to `protocol//hostname:4000`.

## Chosen Approach

Use a single Vercel project with:

- `frontend/` built to static assets.
- a Vercel API function that imports the Express app.
- Postgres as the only persistent runtime storage.
- OpenAPI spec text stored in Postgres, not the deployment filesystem.
- Vercel rewrites for `/api/*`, `/openapi/*`, and React Router routes.

This keeps infrastructure simple: Vercel plus Postgres only.

## Backend Design

Split backend startup into two entry points:

- `backend/src/app.ts`: creates and exports the Express app and initialization helpers.
- `backend/src/server.ts`: local-only server startup using `.listen(...)`.
- `api/index.ts`: Vercel function entry point that imports the same Express app without starting a long-running server.

The local `npm run dev:backend` command should continue to start the local server on `HOST` and `PORT`.

## OpenAPI Spec Storage

Move mutable OpenAPI spec content from files to Postgres.

Add spec content columns:

- `apis.openapi_spec_text TEXT`
- `api_versions.openapi_spec_text TEXT`

Keep `openapi_spec_path` as a stable public identifier, for example:

```txt
/openapi/api-nira-01-1-0-0.yaml
```

That preserves existing frontend links and docs/access-control flows while changing the backing storage.

Replace filesystem operations with database operations:

- API registration stores validated spec text in `apis` and the initial `api_versions` row.
- Version publishing stores spec text in `api_versions`.
- Version promotion updates `apis.openapi_spec_path` and `apis.openapi_spec_text` from the promoted version.
- API edit updates the current spec text in Postgres.
- API deletion deletes database rows and no longer deletes files.
- Startup no longer reconciles orphaned files.
- Backfill logic no longer depends on reading files at runtime.

Serve specs from Postgres:

- `GET /openapi/:filename` returns YAML text after applying the same visibility checks currently used for downloadable OpenAPI assets.
- `GET /api/catalog/:id/spec` loads YAML text from Postgres, parses it, and returns JSON.
- `GET /api/docs/:id/spec` does the same for documentation pages.

## Frontend Design

Keep local behavior intact:

- In local development, `frontend/.env` can keep `VITE_API_BASE_URL=http://localhost:4000`.
- In production, the app should work without a separate API domain.

Adjust API base resolution:

- If `VITE_API_BASE_URL` is set, use it.
- If not set and the app is running on localhost, fall back to `http://localhost:4000`.
- Otherwise use same-origin requests.

This allows Vercel production to call `/api/...` on the same deployed domain while keeping the existing local dev flow.

## Vercel Configuration

Add root-level Vercel configuration to:

- build the frontend from `frontend/`.
- output `frontend/dist`.
- route API traffic to the Vercel function.
- route `/openapi/*` to the same backend function.
- route all other paths to the Vite SPA fallback.

Expected production routing:

```txt
/api/*       -> Express app through Vercel function
/openapi/*   -> Express app through Vercel function
/*           -> frontend/dist/index.html
```

## Environment Variables

Local backend:

```txt
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgresql://...
DATABASE_SSL=false
```

Vercel backend:

```txt
DATABASE_URL=postgresql://...
DATABASE_SSL=true
GOVHUB_TRUST_TLS_TERMINATION=true
GOVHUB_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
GOVHUB_ADMIN_EMAIL=...
GOVHUB_ADMIN_PASSWORD=...
GOVHUB_DEMO_DEVELOPER_EMAIL=...
GOVHUB_DEMO_DEVELOPER_PASSWORD=...
GOVHUB_DEMO_API_OWNER_EMAIL=...
GOVHUB_DEMO_API_OWNER_PASSWORD=...
GOVHUB_DEMO_REVIEWER_EMAIL=...
GOVHUB_DEMO_REVIEWER_PASSWORD=...
```

Production frontend:

- `VITE_API_BASE_URL` can be omitted when using same-origin Vercel routing.
- It remains supported for staging or split deployments.

## Local Compatibility

The following commands should keep working:

```bash
npm run db:up
npm run seed
npm run dev
npm run dev:e2e
npm run build
npm test
```

Local behavior should remain the same from a user perspective:

- catalog pages load.
- login/signup/session flows work.
- dashboard workflows work.
- access requests and approvals work.
- API registration works.
- OpenAPI docs pages work.
- `/openapi/*.yaml` links still download YAML.
- sandbox endpoints work.

The main local runtime change is that OpenAPI specs are stored in the local Postgres container instead of `backend/openapi/`.

## Testing

Verification should include:

- backend typecheck.
- backend tests.
- frontend build.
- local smoke test against `npm run dev`.
- check `/api/health`.
- check `/api/catalog`.
- check `/docs` and one `/docs/:id` page.
- check `/openapi/:filename`.
- check API registration with inline OpenAPI text.
- check API version publish and promotion.

## Risks

- Some backend modules still use filesystem assumptions for OpenAPI specs and must be fully migrated.
- Vercel function cold starts may make first API responses slower than local Express.
- Large OpenAPI specs stored in Postgres increase database row size, but this is acceptable for the prototype and avoids a second storage service.
- Existing uncommitted work must not be overwritten during implementation.
