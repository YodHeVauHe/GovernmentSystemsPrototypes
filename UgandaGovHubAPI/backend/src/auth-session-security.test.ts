import assert from 'assert';
import { adminUsersRouter } from './routes/auth';
import type { AuthUser } from './auth';
import type { Db, DbClient } from './db';

type MockRequest = {
  params: Record<string, string>;
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

const suspendedUser = authUser({
  id: 'target-user',
  full_name: 'Suspended Developer',
  email: 'target@example.go.ug',
});

class AuthSessionSecurityDb implements Db {
  revokedSessionsForTarget = false;
  private targetStatus = suspendedUser.status;

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
    if (id === suspendedUser.id) {
      return {
        ...suspendedUser,
        status: this.targetStatus,
      };
    }
    return null;
  }

  private async querySql<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [adminUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
      const user = this.userById(params[0]);
      return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 };
    }

    if (normalizedSql.startsWith('LOCK TABLE users')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes("UPDATE users SET status = 'SUSPENDED'")) {
      this.targetStatus = 'SUSPENDED';
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'suspended'")) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('UPDATE sessions SET revoked_at = $1 WHERE user_id = $2')) {
      this.revokedSessionsForTarget = params[1] === suspendedUser.id;
      return { rows: [], rowCount: this.revokedSessionsForTarget ? 1 : 0 };
    }

    if (normalizedSql.includes('FROM information_schema.tables')) {
      return { rows: [{ exists: false } as T], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in auth session security test: ${normalizedSql}`);
  }
}

async function runAuthSessionSecurityTest() {
  const db = new AuthSessionSecurityDb();
  const response = await invokeRoute(adminUsersRouter(db), '/:id/suspend', 'post', {
    params: { id: suspendedUser.id },
    headers: { authorization: 'Bearer admin-session' },
    body: {},
    ip: '127.0.0.1',
  });

  assert.equal(response.status, 200);
  assert.equal(
    db.revokedSessionsForTarget,
    true,
    'suspending an account must revoke active sessions for the suspended user',
  );
}

void runAuthSessionSecurityTest().catch(error => {
  console.error(error);
  process.exit(1);
});
