import assert from 'assert';
import { authRouter } from './routes/auth';
import { getTotpCode, hashPassword, type AuthUser } from './auth';
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

const mfaSecret = 'JBSWY3DPEHPK3PXP';
const validTotpCode = getTotpCode(mfaSecret);
const wrongTotpCode = validTotpCode === '000000' ? '000001' : '000000';
const password = 'StrongPassword1!';

const mfaUser: AuthUser = {
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
  mfa_secret_encrypted: encryptAtRest(mfaSecret),
  mfa_enabled_at: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

class MfaRateLimitSecurityDb implements Db {
  private counts = new Map<string, number>();

  async exec() {}

  async close() {}

  async transaction<T>(callback: (client: Db) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [mfaUser as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT * FROM users WHERE id = $1')) {
      return { rows: [mfaUser as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT * FROM users WHERE email = $1')) {
      return { rows: [mfaUser as T], rowCount: 1 };
    }

    if (normalizedSql.startsWith('INSERT INTO rate_limits')) {
      const bucketKey = String(params[0]);
      const group = String(params[1]);
      const resetAt = String(params[2]);
      const key = `${bucketKey}:${group}`;
      const count = (this.counts.get(key) || 0) + 1;
      this.counts.set(key, count);
      return { rows: [{ count, reset_at: resetAt } as T], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in MFA rate-limit security test: ${normalizedSql}`);
  }
}

async function runMfaRateLimitSecurityTest() {
  const db = new MfaRateLimitSecurityDb();
  const router = authRouter(db);
  let response = { status: 0, body: {} as Record<string, unknown> };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await invokeRoute(router, '/mfa/disable', 'post', {
      params: {},
      headers: { authorization: 'Bearer active-session' },
      body: {
        password,
        code: wrongTotpCode,
      },
      ip: '127.0.0.1',
    });
  }

  assert.equal(response.status, 429);
  assert.equal(response.body.code, 'MFA_RATE_LIMITED');
}

async function runLoginMfaRateLimitSecurityTest() {
  const db = new MfaRateLimitSecurityDb();
  const router = authRouter(db);
  let response = { status: 0, body: {} as Record<string, unknown> };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await invokeRoute(router, '/login', 'post', {
      params: {},
      headers: {},
      body: {
        email: mfaUser.email,
        password,
        mfa_code: wrongTotpCode,
      },
      ip: `203.0.113.${attempt + 1}`,
    });
  }

  assert.equal(
    response.status,
    429,
    'login MFA code guesses must be rate-limited per user even when source IP changes',
  );
  assert.equal(response.body.code, 'MFA_RATE_LIMITED');
}

async function runMfaRateLimitSecurityTests() {
  await runMfaRateLimitSecurityTest();
  await runLoginMfaRateLimitSecurityTest();
}

void runMfaRateLimitSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
