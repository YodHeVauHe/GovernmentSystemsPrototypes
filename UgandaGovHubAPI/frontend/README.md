# Uganda GovHub API Frontend

This is the React/Vite frontend for the Uganda GovHub API prototype.

## What It Provides

- API catalog discovery and API detail pages.
- Custom OpenAPI documentation pages at `/docs` and `/docs/:apiId`.
- Sandbox try-it workflows for approved API access.
- Login, signup, account verification, and MFA management.
- Admin dashboard for access approvals, account review, audit logs, analytics, and the interoperability matrix.
- API registration screens for validating and onboarding OpenAPI specifications.

## Local Development

From the repository root, install dependencies and start both services:

```bash
npm run install:all
npm run dev
```

To run only the frontend:

```bash
cd frontend
npm run dev
```

The frontend resolves the backend URL from `VITE_API_BASE_URL` when set. If it is not set, it uses the current browser hostname with backend port `4000`, which keeps `localhost` and `127.0.0.1` sessions consistent.

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
