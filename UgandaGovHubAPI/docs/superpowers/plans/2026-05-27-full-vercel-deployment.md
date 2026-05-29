# Full Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Vite frontend and Express API as one Vercel deployment while preserving the existing local `npm run db:up`, `npm run seed`, and `npm run dev` workflow.

**Architecture:** Split the backend into a reusable Express app and a local server entry point. Add a Vercel function that mounts the same app, move OpenAPI spec runtime storage from files into Postgres, and configure Vercel rewrites for API, OpenAPI downloads, and React Router fallback.

**Tech Stack:** Vite, React, Express 5, TypeScript, Postgres via `pg`, Vercel Node Functions.

---

## File Structure

- Create `backend/src/app.ts`: Express app factory and async initialization guard.
- Create `backend/src/server.ts`: local-only `.listen(...)` startup.
- Create `backend/src/openapi-store.ts`: Postgres-backed OpenAPI spec storage helpers.
- Create `backend/src/openapi-store.test.ts`: unit tests for spec path generation and lookup behavior.
- Create `api/index.ts`: Vercel function entry point.
- Create `vercel.json`: root Vercel build/output/routing configuration.
- Modify `backend/src/index.ts`: remove after its contents are moved, or turn it into a compatibility re-export.
- Modify `backend/src/package.json`: update `dev`, add production-safe scripts as needed.
- Modify `backend/src/versioning.ts`: add schema columns and remove runtime file backfill dependency.
- Modify `backend/src/seed.ts`: seed OpenAPI spec text into Postgres.
- Modify `backend/src/routes/docs.ts`: read specs from Postgres instead of disk.
- Modify `backend/src/docs-access.ts`: preserve visibility checks by `openapi_spec_path`.
- Modify `backend/src/admin.ts`: remove OpenAPI file deletion/path helpers from runtime paths, keep unrelated API-key helpers.
- Modify `backend/src/catalog-sql.ts`: include `openapi_spec_text` in catalog updates where needed.
- Modify `backend/src/*test.ts`: update schemas to include `openapi_spec_text` where assertions touch API tables.
- Modify `frontend/src/lib/api-base.ts`: support same-origin production fallback.
- Modify `README.md`: document full Vercel deployment and local compatibility.

---

### Task 1: Add Postgres OpenAPI Store Helpers

**Files:**
- Create: `backend/src/openapi-store.ts`
- Create: `backend/src/openapi-store.test.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Write the failing OpenAPI store tests**

Create `backend/src/openapi-store.test.ts`:

```ts
import assert from 'assert/strict';
import {
  buildOpenApiPath,
  filenameFromOpenApiPath,
  normalizeOpenApiPath,
} from './openapi-store';

assert.equal(buildOpenApiPath('api-nira-01', '1.0.0'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(buildOpenApiPath('api nira 01', 'v2 beta'), '/openapi/api-nira-01-v2-beta.yaml');

assert.equal(normalizeOpenApiPath('/openapi/api-nira-01-1-0-0.yaml'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(normalizeOpenApiPath('api-nira-01-1-0-0.yaml'), '/openapi/api-nira-01-1-0-0.yaml');
assert.equal(normalizeOpenApiPath('/openapi/../secret.yaml'), null);
assert.equal(normalizeOpenApiPath('/wrong/api.yaml'), null);

assert.equal(filenameFromOpenApiPath('/openapi/api-nira-01-1-0-0.yaml'), 'api-nira-01-1-0-0.yaml');
assert.equal(filenameFromOpenApiPath('/openapi/../secret.yaml'), null);

console.log('openapi store tests passed');
```

- [ ] **Step 2: Add the test script**

Modify `backend/package.json` scripts:

```json
"test:openapi-store": "ts-node src/openapi-store.test.ts",
"test": "npm run typecheck && npm run test:db && npm run test:ids && npm run test:catalog-spec-input && npm run test:openapi-store && npm run test:openapi-reconciliation"
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
cd backend && npm run test:openapi-store
```

Expected: FAIL because `backend/src/openapi-store.ts` does not exist.

- [ ] **Step 4: Implement helper module**

Create `backend/src/openapi-store.ts`:

```ts
import yaml from 'js-yaml';
import type { DbClient } from './db';
import { one } from './db';
import { slugifyVersion } from './versioning';

export type StoredOpenApiSpec = {
  api_id: string;
  openapi_spec_path: string;
  openapi_spec_text: string;
};

export function buildOpenApiPath(apiId: string, version: string) {
  const safeApiId = apiId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'api';
  return `/openapi/${safeApiId}-${slugifyVersion(version)}.yaml`;
}

export function normalizeOpenApiPath(pathOrFilename: string) {
  const raw = String(pathOrFilename || '').trim();
  const normalized = raw.startsWith('/openapi/') ? raw : `/openapi/${raw.replace(/^\/+/, '')}`;
  if (!normalized.startsWith('/openapi/') || normalized.includes('..')) return null;
  const filename = normalized.replace(/^\/openapi\/+/, '');
  if (!filename || filename.includes('/') || !/^[a-zA-Z0-9._-]+\.ya?ml$/.test(filename)) return null;
  return `/openapi/${filename}`;
}

export function filenameFromOpenApiPath(openapiPath: string) {
  const normalized = normalizeOpenApiPath(openapiPath);
  return normalized ? normalized.replace(/^\/openapi\/+/, '') : null;
}

export async function getSpecByPath(db: DbClient, openapiPath: string): Promise<StoredOpenApiSpec | undefined> {
  const normalized = normalizeOpenApiPath(openapiPath);
  if (!normalized) return undefined;

  const apiSpec = await one<StoredOpenApiSpec>(db, `
    SELECT id AS api_id, openapi_spec_path, openapi_spec_text
    FROM apis
    WHERE openapi_spec_path = $1
      AND openapi_spec_text IS NOT NULL
  `, [normalized]);
  if (apiSpec) return apiSpec;

  return one<StoredOpenApiSpec>(db, `
    SELECT api_id, openapi_spec_path, openapi_spec_text
    FROM api_versions
    WHERE openapi_spec_path = $1
      AND openapi_spec_text IS NOT NULL
  `, [normalized]);
}

export async function getCurrentSpecForApi(db: DbClient, apiId: string): Promise<StoredOpenApiSpec | undefined> {
  return one<StoredOpenApiSpec>(db, `
    SELECT id AS api_id, openapi_spec_path, openapi_spec_text
    FROM apis
    WHERE id = $1
      AND openapi_spec_path IS NOT NULL
      AND openapi_spec_text IS NOT NULL
  `, [apiId]);
}

export async function getVersionSpecForApi(db: DbClient, apiId: string, version: string): Promise<StoredOpenApiSpec | undefined> {
  return one<StoredOpenApiSpec>(db, `
    SELECT api_id, openapi_spec_path, openapi_spec_text
    FROM api_versions
    WHERE api_id = $1
      AND version = $2
      AND openapi_spec_path IS NOT NULL
      AND openapi_spec_text IS NOT NULL
  `, [apiId, version]);
}

export function parseStoredOpenApiSpec(specText: string) {
  return yaml.load(specText);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd backend && npm run test:openapi-store
```

Expected: PASS with `openapi store tests passed`.

---

### Task 2: Add Spec Text Columns to Schemas

**Files:**
- Modify: `backend/src/index.ts` initially, later moved to `backend/src/app.ts`
- Modify: `backend/src/versioning.ts`
- Modify: `backend/src/seed.ts`
- Modify: test schemas that create `apis` or `api_versions`

- [ ] **Step 1: Write failing schema expectations**

Add assertions to `backend/src/openapi-store.test.ts` after the existing helper assertions:

```ts
const apiTableSql = `
  CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    openapi_spec_path TEXT,
    openapi_spec_text TEXT
  );
`;
const versionTableSql = `
  CREATE TABLE api_versions (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    openapi_spec_path TEXT NOT NULL,
    openapi_spec_text TEXT
  );
`;

assert.match(apiTableSql, /openapi_spec_text TEXT/);
assert.match(versionTableSql, /openapi_spec_text TEXT/);
```

- [ ] **Step 2: Update runtime schema creation**

In the catalog schema creation SQL currently in `backend/src/index.ts`, change the `apis` table definition from:

```sql
openapi_spec_path TEXT,
```

to:

```sql
openapi_spec_path TEXT,
openapi_spec_text TEXT,
```

In `backend/src/versioning.ts`, change the `api_versions` table definition from:

```sql
openapi_spec_path TEXT NOT NULL,
spec_sha TEXT NOT NULL,
```

to:

```sql
openapi_spec_path TEXT NOT NULL,
openapi_spec_text TEXT,
spec_sha TEXT NOT NULL,
```

- [ ] **Step 3: Add migration helpers for existing databases**

In `backend/src/versioning.ts`, import `hasColumn`:

```ts
import { exec, hasColumn, many, one, run } from './db';
```

After creating `api_versions`, add:

```ts
if (!await hasColumn(db, 'api_versions', 'openapi_spec_text')) {
  await exec(db, 'ALTER TABLE api_versions ADD COLUMN openapi_spec_text TEXT');
}
```

In the catalog schema initializer that creates `apis`, add an `openapi_spec_text` column check after table creation:

```ts
import { hasColumn } from './db';

if (!await hasColumn(db, 'apis', 'openapi_spec_text')) {
  await db.exec('ALTER TABLE apis ADD COLUMN openapi_spec_text TEXT');
}
```

If this initializer is moved to `backend/src/app.ts` in Task 5 before this task is implemented, apply the change there instead.

- [ ] **Step 4: Update seed schema**

In `backend/src/seed.ts`, change:

```sql
openapi_spec_path TEXT,
required_approval_level TEXT,
```

to:

```sql
openapi_spec_path TEXT,
openapi_spec_text TEXT,
required_approval_level TEXT,
```

- [ ] **Step 5: Update test schemas**

For every test schema that defines `apis` and uses OpenAPI fields, add:

```sql
openapi_spec_text TEXT,
```

For every test schema that defines `api_versions`, add:

```sql
openapi_spec_text TEXT,
```

At minimum check:

```bash
rg "CREATE TABLE apis|CREATE TABLE api_versions" backend/src
```

- [ ] **Step 6: Run backend typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected: PASS.

---

### Task 3: Store Seed OpenAPI Specs in Postgres

**Files:**
- Modify: `backend/src/seed.ts`
- Modify: `backend/src/versioning.ts`

- [ ] **Step 1: Add seed helper to load bundled spec files**

In `backend/src/seed.ts`, add imports:

```ts
import fs from 'fs';
import path from 'path';
```

Add helper near the top:

```ts
function readSeedSpec(openapiPath: string) {
  const filePath = path.join(__dirname, '..', openapiPath);
  return fs.readFileSync(filePath, 'utf8');
}
```

- [ ] **Step 2: Include `openapi_spec_text` in seed insert**

Change the `insertApi` SQL column list to include `openapi_spec_text` after `openapi_spec_path`:

```sql
sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text, required_approval_level, contact_office,
```

Change the values placeholder count from 20 to 21 placeholders.

For each seeded API row, insert `readSeedSpec(...)` after the `openapi_spec_path` value:

```ts
'High', 1, '/openapi/nira-identity.yaml', readSeedSpec('/openapi/nira-identity.yaml'), 'Director General',
```

Repeat for:

```txt
/openapi/ura-tax.yaml
/openapi/ursb-business.yaml
/openapi/driving-permit.yaml
/openapi/service-uganda.yaml
```

- [ ] **Step 3: Backfill `api_versions.openapi_spec_text` from current API rows**

In `backend/src/versioning.ts`, update the backfill query:

```ts
const apis = await many(db, 'SELECT id, openapi_spec_path, openapi_spec_text FROM apis');
```

Keep the backfill database-only:

```ts
const specText = api.openapi_spec_text;
if (!specText) continue;
```

Update the insert column list:

```sql
id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
```

Add `specText` to insert values immediately after `api.openapi_spec_path`.

- [ ] **Step 4: Remove runtime directory creation from versioning**

Delete this block from `backend/src/versioning.ts`:

```ts
if (!fs.existsSync(openapiDir)) {
  fs.mkdirSync(openapiDir, { recursive: true });
}
```

Remove `fs` and `path` imports from `backend/src/versioning.ts` if no longer used.

- [ ] **Step 5: Verify seed and versioning tests**

Run:

```bash
cd backend && npm run typecheck && npm run test:openapi-store
```

Expected: PASS.

---

### Task 4: Replace Runtime Spec File Reads and Writes

**Files:**
- Modify: `backend/src/index.ts` initially, later moved to `backend/src/app.ts`
- Modify: `backend/src/routes/docs.ts`
- Modify: `backend/src/admin.ts`
- Modify: `backend/src/catalog-sql.ts`

- [ ] **Step 1: Remove runtime file helpers from the main app**

Delete these concepts from the main app file:

```ts
const openapiRoot = path.join(__dirname, '../openapi');
reconcileOrphanedSpecFiles()
writeOpenApiSpecFile(...)
express.static(openapiRoot)
deleteSpecFiles(...)
resolveOpenApiFilePath(...)
```

Keep `fs` only if still needed for TLS through `backend/src/tls.ts`; it should not be used for runtime OpenAPI specs.

- [ ] **Step 2: Add `/openapi/:filename` DB-backed route**

In the main app file, import:

```ts
import { getSpecByPath, normalizeOpenApiPath } from './openapi-store';
```

Replace the static `/openapi` middleware with:

```ts
app.get('/openapi/:filename', optionalAuth(db), async (req, res) => {
  const openapiPath = normalizeOpenApiPath(req.params.filename);
  if (!openapiPath) {
    return res.status(404).json({ error: 'API documentation was not found.', code: 'NOT_FOUND' });
  }

  const decision = await canDownloadOpenApiAsset(db, req.user, openapiPath);
  if (!decision.allowed) {
    const status = decision.code === 'UNAUTHENTICATED' ? 401 : decision.code === 'NOT_FOUND' ? 404 : 403;
    return res.status(status).json({ error: decision.message, code: decision.code });
  }

  const spec = await getSpecByPath(db, openapiPath);
  if (!spec) {
    return res.status(404).json({ error: 'Spec not found', code: 'SPEC_NOT_FOUND' });
  }

  res.type('yaml').send(spec.openapi_spec_text);
});
```

- [ ] **Step 3: Update version publish inserts**

Where version publishing inserts into `api_versions`, add `openapi_spec_text`:

```sql
id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
```

Pass `openapiSpec` after `relativeSpecPath`.

Remove `specFile.commit()` and `specFile.cleanup()` logic from version publishing.

- [ ] **Step 4: Update version promotion**

Change the version lookup to include spec text:

```ts
const version = await db.prepare('SELECT * FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, req.params.version) as any;
```

Update API promotion SQL:

```ts
await db.prepare('UPDATE apis SET openapi_spec_path = ?, openapi_spec_text = ? WHERE id = ?')
  .run(version.openapi_spec_path, version.openapi_spec_text, req.params.id);
```

- [ ] **Step 5: Update parsed catalog spec route**

In `GET /api/catalog/:id/spec`, replace file reads with:

```ts
const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null;
const spec = requestedVersion
  ? await getVersionSpecForApi(db, req.params.id, requestedVersion)
  : await getCurrentSpecForApi(db, req.params.id);

if (!spec) {
  return res.status(404).json({ error: 'API spec not found' });
}

const decision = await canDownloadOpenApiAsset(db, req.user, spec.openapi_spec_path);
if (!decision.allowed) {
  const status = decision.code === 'UNAUTHENTICATED' ? 401 : decision.code === 'NOT_FOUND' ? 404 : 403;
  return res.status(status).json({ error: decision.message, code: decision.code });
}

res.json(yaml.load(spec.openapi_spec_text));
```

Import:

```ts
import { getCurrentSpecForApi, getVersionSpecForApi } from './openapi-store';
```

- [ ] **Step 6: Update API patch/edit spec writes**

When `versionPatch` is created, add:

```ts
specText: resolvedSpec,
```

Update `apis` update SQL so it writes `openapi_spec_text`.

If `UPDATE_API_SQL` is used, modify `backend/src/catalog-sql.ts` to set:

```sql
openapi_spec_text = ?,
```

immediately after `openapi_spec_path = ?`.

Update all callers and tests to pass the extra value.

Update current version patch SQL to set `openapi_spec_text = ?`.

- [ ] **Step 7: Update API registration**

In API registration insert SQL, add `openapi_spec_text` after `openapi_spec_path`.

Pass `openapiSpec` after `relativeSpecPath`.

For initial `api_versions` insert, add `openapi_spec_text` and pass `openapiSpec`.

Remove `specFile.commit()` and `specFile.cleanup()` from registration.

- [ ] **Step 8: Update API deletion**

Remove file deletion:

```ts
deleteSpecFiles(specPaths, openapiRoot);
```

Delete database rows only.

- [ ] **Step 9: Update docs route spec parsing**

In `backend/src/routes/docs.ts`, remove:

```ts
import fs from 'fs';
import path from 'path';
import { resolveOpenApiFilePath } from '../admin';
```

Import:

```ts
import { getCurrentSpecForApi } from '../openapi-store';
```

Replace the `/:id/spec` file read block with:

```ts
const spec = await getCurrentSpecForApi(db, String(req.params.id));
if (!spec) {
  return res.status(404).json({ error: 'OpenAPI document is missing for this API.', code: 'SPEC_NOT_FOUND' });
}

res.json(yaml.load(spec.openapi_spec_text));
```

- [ ] **Step 10: Run focused tests**

Run:

```bash
cd backend && npm run typecheck && npm run test:catalog-sql && npm run test:docs-access && npm run test:openapi-store
```

Expected: PASS.

---

### Task 5: Split Express App From Local Server

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Create `backend/src/app.ts` from current app setup**

Move Express app creation, middleware, routes, schema initialization, and `db` export from `backend/src/index.ts` into `backend/src/app.ts`.

Use this public shape:

```ts
export const db = createDb();
export const app = express();

let initialized: Promise<void> | null = null;

export function initializeApp() {
  if (!initialized) {
    initialized = (async () => {
      await ensureCatalogSchema();
      await ensureAuthSchema(db);
      await ensureAdminSchema(db);
      await ensureApiVersionSchema(db);
      await ensureDefaultAdmin(db);
      await ensureDemoUsers(db);
      await ensureAccountVerificationSchema(db);
      await ensureDocsSchema(db);
      await initAuditColumnCache(db);
    })();
  }
  return initialized;
}
```

Register middleware before routes:

```ts
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Create local server entry point**

Create `backend/src/server.ts`:

```ts
import dotenv from 'dotenv';
import { app, db, initializeApp } from './app';
import { createTransportServer, getTlsConfig } from './tls';

dotenv.config();

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';

async function start() {
  await initializeApp();
  const server = createTransportServer(app).listen(port, host, () => {
    const protocol = getTlsConfig().enabled ? 'https' : 'http';
    console.log(`Backend running at ${protocol}://${host}:${port}`);
  });

  return server;
}

start().catch(async err => {
  console.error('[STARTUP] Failed to start backend:', err);
  await db.close();
  process.exit(1);
});
```

- [ ] **Step 3: Make `index.ts` a compatibility re-export**

Replace `backend/src/index.ts` with:

```ts
export { app, db, initializeApp } from './app';
```

- [ ] **Step 4: Update backend dev script**

In `backend/package.json`, change:

```json
"dev": "nodemon src/index.ts"
```

to:

```json
"dev": "nodemon src/server.ts"
```

- [ ] **Step 5: Verify local backend typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected: PASS.

---

### Task 6: Add Vercel Function Entry Point

**Files:**
- Create: `api/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Create Vercel API function**

Create `api/index.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { app, initializeApp } from '../backend/src/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await initializeApp();
  return app(req, res);
}
```

- [ ] **Step 2: Add Vercel Node types dependency**

In root `package.json`, add:

```json
"devDependencies": {
  "@vercel/node": "^5.0.0"
}
```

Keep existing dev dependencies. If `@vercel/node` latest differs during install, allow npm to resolve the lockfile.

- [ ] **Step 3: Run typecheck**

Run:

```bash
cd backend && npm run typecheck
```

Expected: PASS.

Root TypeScript may not typecheck `api/index.ts` yet because there is no root tsconfig. Vercel will compile it; if local verification is desired, add a root `tsconfig.json` in Task 8.

---

### Task 7: Update Frontend API Base Resolution

**Files:**
- Modify: `frontend/src/lib/api-base.ts`
- Create or modify: `frontend/src/lib/api-base.test.ts` if the project supports direct TS tests; otherwise validate through build.

- [ ] **Step 1: Replace API base resolver**

Update `frontend/src/lib/api-base.ts`:

```ts
export function resolveApiBase(
  explicitBase: string | undefined,
  locationLike: Pick<Location, 'protocol' | 'hostname' | 'origin'> = window.location,
) {
  if (explicitBase) return explicitBase;
  const hostname = locationLike.hostname || 'localhost';
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const protocol = locationLike.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${hostname}:4000`;
  }
  return locationLike.origin || '';
}

export const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);
```

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

---

### Task 8: Add Vercel Configuration

**Files:**
- Create: `vercel.json`
- Modify: `package.json`

- [ ] **Step 1: Add root Vercel config**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install && cd frontend && npm install && cd ../backend && npm install",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/openapi/(.*)",
      "destination": "/api"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 2: Ensure root install includes Vercel function dependency**

Run:

```bash
npm install
```

Expected: root `package-lock.json` updates and includes `@vercel/node`.

If network access is blocked, rerun with escalation approval.

- [ ] **Step 3: Verify frontend build from root**

Run:

```bash
npm run build
```

Expected: PASS and `frontend/dist` created.

---

### Task 9: Update Docs and Environment Guidance

**Files:**
- Modify: `README.md`
- Modify: `backend/.env.example` if needed
- Modify: `frontend/.env.example` if needed

- [ ] **Step 1: Update README current implementation**

Change:

```md
- **API contracts:** OpenAPI spec text stored in Postgres and served through `/openapi/` routes.
```

to:

```md
- **API contracts:** OpenAPI specs stored in Postgres and served through `/openapi/*.yaml`.
```

- [ ] **Step 2: Add full Vercel deployment section**

Add:

```md
## Full Vercel Deployment

The app can deploy as one Vercel project:

- Vercel builds the Vite frontend from `frontend/`.
- Vercel routes `/api/*` and `/openapi/*` to the Express API function.
- Vercel routes all other paths to the React Router SPA fallback.
- Postgres is the persistent store for app data and OpenAPI spec text.

Required Vercel environment variables:

```bash
DATABASE_URL=postgresql://...
GOVHUB_TRUST_TLS_TERMINATION=true
GOVHUB_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
GOVHUB_ADMIN_EMAIL=admin@ict.go.ug
GOVHUB_ADMIN_PASSWORD=...
GOVHUB_DEMO_DEVELOPER_EMAIL=...
GOVHUB_DEMO_DEVELOPER_PASSWORD=...
GOVHUB_DEMO_API_OWNER_EMAIL=...
GOVHUB_DEMO_API_OWNER_PASSWORD=...
GOVHUB_DEMO_REVIEWER_EMAIL=...
GOVHUB_DEMO_REVIEWER_PASSWORD=...
```

`VITE_API_BASE_URL` can be omitted on Vercel when same-origin routing is used.
```

- [ ] **Step 3: Keep local env examples intact**

Leave `frontend/.env.example` as:

```txt
VITE_API_BASE_URL=http://localhost:4000
```

Leave `backend/.env.example` with local Postgres:

```txt
DATABASE_SSL=false
```

---

### Task 10: Full Verification

**Files:**
- No new files unless fixing failures.

- [ ] **Step 1: Check worktree before verification**

Run:

```bash
git status --short
```

Expected: Only files touched by this plan plus pre-existing unrelated user changes.

- [ ] **Step 2: Backend typecheck and tests**

Run:

```bash
cd backend && npm run typecheck && npm test
```

Expected: PASS.

- [ ] **Step 3: Frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Root build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Local smoke test**

Start local services:

```bash
npm run db:up
npm run seed
npm run dev
```

In another shell, verify:

```bash
curl -i http://127.0.0.1:4000/api/health
curl -i http://127.0.0.1:4000/api/catalog
curl -i http://127.0.0.1:4000/openapi/nira-identity.yaml
```

Expected:

- `/api/health` returns HTTP 200 JSON with `status: ok`.
- `/api/catalog` returns HTTP 200 JSON.
- `/openapi/nira-identity.yaml` returns HTTP 200 YAML text if visibility permits anonymous access, or the expected auth/visibility response if restricted.

- [ ] **Step 6: Commit implementation if allowed**

If Git staging is permitted:

```bash
git add api vercel.json package.json package-lock.json backend frontend README.md docs/superpowers/plans/2026-05-27-full-vercel-deployment.md
git commit -m "feat: support full Vercel deployment"
```

If Git staging is blocked by sandbox permissions, report the exact files changed and leave commit to the user.
