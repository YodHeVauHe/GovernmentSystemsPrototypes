import assert from 'assert';
import { authRouter } from './routes/auth';
import { hashPassword, type AuthUser } from './auth';
import { encryptAtRest } from './crypto-at-rest';
import type { Db } from './db';

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

const password = 'StrongPassword1!';
const mfaSecret = 'JBSWY3DPEHPK3PXP';

function authUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'mfa-user',
    full_name: 'MFA User',
    email: 'mfa@example.test',
    password_hash: hashPassword(password),
    account_type: 'government_employee',
    requested_role: 'developer',
    requested_mda_id: null,
    requested_organization: 'MFA Test',
    requested_purpose: 'Security regression',
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

class AuthPasswordConfirmationSecurityDb implements Db {
  rateLimitWrites = 0;
  mfaSecretUpdates = 0;

  constructor(private readonly user: AuthUser) {}

  async exec() {}

  async close() {}

  async transaction<T>(callback: (client: Db) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [this.user as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
      return { rows: [this.user as T], rowCount: 1 };
    }

    if (normalizedSql.startsWith('INSERT INTO rate_limits')) {
      this.rateLimitWrites += 1;
      return { rows: [{ count: 1, reset_at: params[2] } as T], rowCount: 1 };
    }

    if (normalizedSql.startsWith('UPDATE users SET mfa_secret_encrypted')) {
      this.mfaSecretUpdates += 1;
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in auth password confirmation security test: ${normalizedSql}`);
  }
}

async function assertOversizedPasswordRejectedBeforeMfaWork(routePath: '/mfa/setup' | '/mfa/disable', user: AuthUser) {
  const db = new AuthPasswordConfirmationSecurityDb(user);
  const oversizedPassword = `${'A'.repeat(1022)}a1!`;
  assert.equal(oversizedPassword.length, 1025);

  const response = await invokeRoute(authRouter(db), routePath, 'post', {
    params: {},
    headers: { authorization: 'Bearer active-session' },
    body: {
      password: oversizedPassword,
      code: '000000',
    },
    ip: '127.0.0.1',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, 'INVALID_PASSWORD_INPUT');
  assert.match(String(response.body.error || ''), /1024/);
  assert.equal(
    db.rateLimitWrites,
    0,
    `${routePath} must reject oversized password confirmations before consuming the MFA rate-limit bucket`,
  );
  assert.equal(
    db.mfaSecretUpdates,
    0,
    `${routePath} must reject oversized password confirmations before mutating MFA state`,
  );
}

async function runAuthPasswordConfirmationSecurityTest() {
  await assertOversizedPasswordRejectedBeforeMfaWork('/mfa/setup', authUser({}));
  await assertOversizedPasswordRejectedBeforeMfaWork(
    '/mfa/disable',
    authUser({
      mfa_secret_encrypted: encryptAtRest(mfaSecret),
      mfa_enabled_at: new Date(0).toISOString(),
    }),
  );
}

void runAuthPasswordConfirmationSecurityTest().catch(error => {
  console.error(error);
  process.exit(1);
});
