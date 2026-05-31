import assert from 'assert';
import { adminUsersRouter } from './routes/auth';
import type { AuthUser } from './auth';
import type { Db, DbClient } from './db';

type MockRequest = {
  params: Record<string, string>;
  query?: Record<string, string>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  ip?: string;
  user?: AuthUser;
};

type MockResponse = {
  statusCode: number;
  body?: Record<string, unknown>;
  ended: boolean;
  status: (statusCode: number) => MockResponse;
  json: (body: Record<string, unknown>) => MockResponse;
};

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    ended: false,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: Record<string, unknown>) {
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

async function invokeRoute(router: any, routePath: string, method: string, req: MockRequest) {
  const res = createMockResponse();

  for (const layer of router.stack) {
    if (res.ended) break;
    if (!layer.route) {
      await invokeMiddleware(layer.handle, req, res);
      continue;
    }
    if (layer.route.path !== routePath || !layer.route.methods?.[method]) continue;
    for (const routeLayer of layer.route.stack) {
      await invokeMiddleware(routeLayer.handle, req, res);
      if (res.ended) break;
    }
  }

  return { status: res.statusCode, body: res.body || {} };
}

function authUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'user-default',
    full_name: 'Default User',
    email: 'default@example.go.ug',
    password_hash: 'scrypt:salt:hash',
    account_type: 'public_developer',
    requested_role: 'developer',
    requested_mda_id: null,
    requested_organization: 'Default Organization',
    requested_purpose: 'Use APIs',
    status: 'APPROVED',
    role: 'developer',
    mda_id: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

const adminUser = authUser({
  id: 'admin-user',
  full_name: 'Platform Admin',
  email: 'admin@example.go.ug',
  account_type: 'government_employee',
  requested_role: 'admin',
  role: 'admin',
  mda_id: 'mda-admin',
});

const listedUser = authUser({
  id: 'listed-user',
  full_name: 'Listed Developer',
  email: 'listed@example.go.ug',
});

const listedProfile = {
  user_id: listedUser.id,
  verification_status: 'verified',
  account_category: 'public_developer',
  nin: null,
  national_id_number: null,
  contact_phone: null,
  address: null,
  organization_name: 'Listed Organization',
  organization_type: null,
  ursb_number: null,
  brn: null,
  tin: null,
  staff_id: null,
  department: null,
  job_title: null,
  supervisor_name: null,
  supervisor_email: null,
  review_notes: null,
  submitted_at: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

class AdminUsersListSecurityDb implements Db {
  sawUnboundedUsersQuery = false;
  listLimit: unknown = null;
  listOffset: unknown = null;
  snapshotLookups = 0;

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

  private userById(id: unknown) {
    if (id === adminUser.id) return adminUser;
    if (id === listedUser.id) return listedUser;
    return null;
  }

  private async querySql<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [adminUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users ORDER BY created_at DESC') {
      this.sawUnboundedUsersQuery = true;
      return { rows: [listedUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC') {
      this.sawUnboundedUsersQuery = true;
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql === 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2') {
      this.listLimit = params[0];
      this.listOffset = params[1];
      return { rows: [listedUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3') {
      this.listLimit = params[1];
      this.listOffset = params[2];
      return { rows: [listedUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
      this.snapshotLookups += params[0] === listedUser.id ? 1 : 0;
      const user = this.userById(params[0]);
      return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 };
    }

    if (
      normalizedSql ===
      'INSERT INTO user_profiles (user_id, account_category, organization_name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING'
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (
      normalizedSql ===
      "UPDATE user_profiles SET verification_status = 'verified', review_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND verification_status = 'draft_profile'"
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql === 'SELECT * FROM user_profiles WHERE user_id = $1') {
      return { rows: params[0] === listedUser.id ? [listedProfile as T] : [], rowCount: params[0] === listedUser.id ? 1 : 0 };
    }

    if (normalizedSql.includes('SELECT * FROM verification_documents')) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected SQL in admin users list security test: ${normalizedSql}`);
  }
}

async function runAdminUsersListSecurityTests() {
  const paginatedDb = new AdminUsersListSecurityDb();
  const paginatedResponse = await invokeRoute(adminUsersRouter(paginatedDb), '/', 'get', {
    params: {},
    query: { limit: '1000000', offset: '-5' },
    headers: { authorization: 'Bearer admin-session' },
    body: {},
    ip: '127.0.0.1',
  });

  assert.equal(paginatedResponse.status, 200);
  assert.equal(paginatedDb.sawUnboundedUsersQuery, false, 'admin user listing must use a bounded LIMIT/OFFSET query');
  assert.equal(paginatedDb.listLimit, 100, 'admin user listing must cap oversized limits to the default page size');
  assert.equal(paginatedDb.listOffset, 0, 'admin user listing must normalize negative offsets to zero');
  assert.equal(paginatedDb.snapshotLookups, 1, 'admin user listing must only hydrate account snapshots for the bounded page');

  const largeOffsetDb = new AdminUsersListSecurityDb();
  const largeOffsetResponse = await invokeRoute(adminUsersRouter(largeOffsetDb), '/', 'get', {
    params: {},
    query: { offset: '1000000000' },
    headers: { authorization: 'Bearer admin-session' },
    body: {},
    ip: '127.0.0.1',
  });

  assert.equal(largeOffsetResponse.status, 200);
  assert.equal(largeOffsetDb.listOffset, 10000, 'admin user listing must cap oversized offsets');

  const invalidStatusDb = new AdminUsersListSecurityDb();
  const invalidStatusResponse = await invokeRoute(adminUsersRouter(invalidStatusDb), '/', 'get', {
    params: {},
    query: { status: 'APPROVED;DROP' },
    headers: { authorization: 'Bearer admin-session' },
    body: {},
    ip: '127.0.0.1',
  });

  assert.equal(invalidStatusResponse.status, 400);
  assert.equal(invalidStatusResponse.body.code, 'INVALID_USER_STATUS');
  assert.equal(
    invalidStatusDb.sawUnboundedUsersQuery,
    false,
    'invalid admin user status filters must be rejected before querying users',
  );
}

void runAdminUsersListSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
