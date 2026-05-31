import assert from 'assert';
import { authRouter } from './routes/auth';
import type { AuthUser, UserRole } from './auth';
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

function signupUser(overrides: Partial<AuthUser>): AuthUser {
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
    status: 'PENDING_REVIEW',
    role: null,
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

class AuthSignupSecurityDb implements Db {
  insertedSignupUser = false;
  private insertedUser: AuthUser | null = null;

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

    if (normalizedSql === 'SELECT * FROM users WHERE email = $1') {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('INSERT INTO users')) {
      this.insertedSignupUser = true;
      this.insertedUser = signupUser({
        id: String(params[0]),
        full_name: String(params[1]),
        email: String(params[2]),
        password_hash: String(params[3]),
        account_type: String(params[4]),
        requested_role: String(params[5]) as UserRole,
        requested_mda_id: params[6] ? String(params[6]) : null,
        requested_organization: String(params[7]),
        requested_purpose: String(params[8]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('INSERT INTO user_profiles')) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
      return { rows: this.insertedUser ? [this.insertedUser as T] : [], rowCount: this.insertedUser ? 1 : 0 };
    }

    throw new Error(`Unexpected SQL in auth signup security test: ${normalizedSql}`);
  }
}

async function runAuthSignupSecurityTest() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalGovhubTurnstileSecret = process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  process.env.NODE_ENV = 'test';
  delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;

  try {
    const db = new AuthSignupSecurityDb();
    const oversizedPassword = `${'A'.repeat(1022)}a1!`;
    assert.equal(oversizedPassword.length, 1025);

    const response = await invokeRoute(authRouter(db), '/signup', 'post', {
      params: {},
      headers: {},
      ip: '127.0.0.1',
      body: {
        full_name: 'Oversized Password User',
        email: 'oversized-password@example.go.ug',
        password: oversizedPassword,
        account_type: 'public_developer',
        requested_role: 'developer',
        requested_organization: 'Personal Project',
        requested_purpose: 'Use APIs for approved public services',
      },
    });

    assert.equal(response.status, 400);
    assert.match(String(response.body.error || ''), /password/i);
    assert.match(String(response.body.error || ''), /1024/);
    assert.equal(
      db.insertedSignupUser,
      false,
      'oversized signup passwords must be rejected before user creation',
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalGovhubTurnstileSecret === undefined) delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
    else process.env.GOVHUB_TURNSTILE_SECRET_KEY = originalGovhubTurnstileSecret;
    if (originalTurnstileSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
  }
}

void runAuthSignupSecurityTest().catch(error => {
  console.error(error);
  process.exit(1);
});
