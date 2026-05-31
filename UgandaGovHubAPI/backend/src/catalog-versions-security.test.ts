import assert from 'assert';
import { catalogVersionsRouter } from './routes/catalog-versions';
import type { AuthUser } from './auth';
import type { Db, DbClient } from './db';

const validOpenApiSpec = `
openapi: 3.0.0
info:
  title: Stale Owner Race Test
  version: 2.0.0
paths:
  /status:
    get:
      responses:
        '200':
          description: OK
`;

function approvedApiOwner(): AuthUser {
  return {
    id: 'user-owner-1',
    full_name: 'MDA API Owner',
    email: 'owner@example.go.ug',
    password_hash: '',
    account_type: 'mda_api_owner',
    requested_role: 'api_owner',
    requested_mda_id: 'mda-old',
    requested_organization: 'Old MDA',
    requested_purpose: 'Manage APIs',
    status: 'APPROVED',
    role: 'api_owner',
    mda_id: 'mda-old',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

class StaleOwnershipDb implements Db {
  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.querySql<T>(sql, params);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    const client: DbClient = {
      query: async <R = any>(sql: string, params: unknown[] = []) => this.querySql<R>(sql, params),
    };
    return callback(client);
  }

  private async querySql<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [approvedApiOwner() as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT id FROM apis WHERE id = $1 AND owning_mda_id = $2')) {
      return { rows: [{ id: params[0] } as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT id FROM apis WHERE id = $1') && normalizedSql.includes('owning_mda_id') && normalizedSql.includes('FOR UPDATE')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('SELECT id FROM apis WHERE id = $1')) {
      return { rows: [{ id: params[0] } as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT id FROM api_versions WHERE api_id = $1 AND (version = $2 OR id = $3)')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.startsWith('UPDATE api_versions SET is_current = FALSE')) {
      return { rows: [], rowCount: 1 };
    }

    if (
      normalizedSql.includes('UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3')
      && normalizedSql.includes('owning_mda_id')
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3')) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('INSERT INTO api_versions')) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('INSERT INTO audit_logs')) {
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in catalog version security test: ${normalizedSql}`);
  }
}

class VersionListDb implements Db {
  versionListQuery?: { sql: string; params: unknown[] };

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql === 'SELECT spec_sha FROM api_versions WHERE api_id = $1 AND is_current = TRUE') {
      return { rows: [{ spec_sha: 'sha-current' } as T], rowCount: 1 };
    }

    if (normalizedSql.includes('FROM api_versions') && normalizedSql.includes('ORDER BY is_current DESC, created_at DESC')) {
      this.versionListQuery = { sql: normalizedSql, params };
      return {
        rows: [{
          id: 'version-1',
          api_id: params[0],
          version: '1.0.0',
          openapi_spec_path: '/openapi/test-1.yaml',
          spec_sha: 'sha-current',
          endpoints_count: 1,
          openapi_version: '3.0.0',
          status: 'Published',
          is_current: true,
          notes: null,
          created_at: new Date(0).toISOString(),
        } as T],
        rowCount: 1,
      };
    }

    throw new Error(`Unexpected SQL in catalog version list security test: ${normalizedSql}`);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(_callback: (client: DbClient) => Promise<T>): Promise<T> {
    throw new Error('Version list security test should not open a transaction.');
  }
}

type MockRequest = {
  params: { id: string };
  query?: Record<string, unknown>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  user?: AuthUser;
};

type MockResponse = {
  statusCode: number;
  body?: unknown;
  ended: boolean;
  status: (statusCode: number) => MockResponse;
  json: (body: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    ended: false,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      this.ended = true;
      return this;
    },
  };
  return response;
}

async function invokeMiddleware(
  handle: (req: MockRequest, res: MockResponse, next: (error?: unknown) => void) => unknown,
  req: MockRequest,
  res: MockResponse,
) {
  await new Promise<void>((resolve, reject) => {
    let nextCalled = false;
    const next = (error?: unknown) => {
      nextCalled = true;
      if (error) reject(error);
      else resolve();
    };

    Promise.resolve(handle(req, res, next)).then(() => {
      if (res.ended || !nextCalled) resolve();
    }, reject);
  });
}

async function requestCatalogVersions(db: Db) {
  const router = catalogVersionsRouter(db, async () => ({ allowed: true, visibility: 'restricted' }));
  const postRoute = (router as any).stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.post);
  assert(postRoute, 'POST / route must exist');

  const req: MockRequest = {
    params: { id: 'api-owned-before-race' },
    headers: { authorization: 'Bearer test-session' },
    body: {
      openapi_spec: validOpenApiSpec,
      make_current: true,
    },
  };
  const res = createMockResponse();

  for (const layer of postRoute.route.stack) {
    await invokeMiddleware(layer.handle, req, res);
    if (res.ended) break;
  }

  return {
    status: res.statusCode,
    body: (res.body || {}) as Record<string, unknown>,
  };
}

async function listCatalogVersions(db: VersionListDb) {
  const router = catalogVersionsRouter(db, async () => ({ allowed: true, visibility: 'public' }));
  const getRoute = (router as any).stack.find((layer: any) => layer.route?.path === '/' && layer.route?.methods?.get);
  assert(getRoute, 'GET / route must exist');

  const req: MockRequest = {
    params: { id: 'api-with-many-versions' },
    query: { limit: '1000000', offset: '-5' },
    headers: {},
    body: {},
  };
  const res = createMockResponse();

  for (const layer of getRoute.route.stack) {
    await invokeMiddleware(layer.handle, req, res);
    if (res.ended) break;
  }

  return {
    status: res.statusCode,
    body: res.body,
    query: db.versionListQuery,
  };
}

async function runCatalogVersionSecurityTests() {
  const response = await requestCatalogVersions(new StaleOwnershipDb());

  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'VERSION_PUBLISH_STALE');

  const versionList = await listCatalogVersions(new VersionListDb());
  assert.equal(versionList.status, 200);
  assert(versionList.query, 'catalog version list query must be executed');
  assert.match(
    versionList.query.sql,
    /\bLIMIT\b.+\bOFFSET\b/i,
    'Catalog version listing must use bounded LIMIT/OFFSET pagination.',
  );
  assert.deepEqual(versionList.query.params.slice(-2), [100, 0]);
}

runCatalogVersionSecurityTests();
