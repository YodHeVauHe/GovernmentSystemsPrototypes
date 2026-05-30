# Uganda GovHub API Frontend

<p align="center">
  <img src="./public/favicon.svg" alt="Uganda GovHub API app icon" width="72" height="72" />
</p>

This is the React/Vite frontend for the Uganda GovHub API prototype.

## What It Provides

- API catalog discovery and API detail pages.
- Custom OpenAPI documentation pages at `/docs` and `/docs/:apiId`.
- Sandbox try-it workflows for approved API access.
- Login, signup, account verification, and MFA management.
- Admin dashboard for access approvals, account review, audit logs, analytics, and the interoperability matrix.
- API registration screens for validating and onboarding OpenAPI specifications.

## Local Development

From the repository root, install dependencies, start local Postgres, seed the backend database, and start both services:

```bash
npm run install:all
npm run db:up
npm run seed
npm run dev
```

The backend is Postgres-only. Local development uses the root `db:up` script to run a `postgres:16-alpine` container on `localhost:5432`, matching the `DATABASE_URL` in `backend/.env.example`.

To run only the frontend:

```bash
cd frontend
npm run dev
```

The frontend can run by itself, but authenticated pages, catalog data, docs, and sandbox workflows need the backend running at port `4000`.

The frontend resolves the backend URL from `VITE_API_BASE_URL` when set. If it is not set on `localhost` or `127.0.0.1`, it uses the current browser hostname with backend port `4000`. In deployed environments, it falls back to same-origin requests so Vercel can route `/api/*` and `/openapi/*` to the backend function.

Example:

```bash
VITE_API_BASE_URL=http://127.0.0.1:4000 npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Notes

This frontend is not the default Vite template anymore. It is the working GovHub portal UI for the interoperability demo.
