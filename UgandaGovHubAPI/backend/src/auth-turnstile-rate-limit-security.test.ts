import assert from 'assert';
import { authRouter } from './routes/auth';
import type { Db, DbClient } from './db';

type MockRequest = {
  params: Record<string, string>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  ip?: string;
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

class TurnstileRateLimitDb implements Db {
  private readonly buckets = new Map<string, number>();

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('INSERT INTO rate_limits')) {
      const bucketKey = String(params[0]);
      const group = String(params[1]);
      const resetAt = String(params[2]);
      const mapKey = `${group}:${bucketKey}`;
      const count = (this.buckets.get(mapKey) || 0) + 1;
      this.buckets.set(mapKey, count);
      return { rows: [{ count, reset_at: resetAt } as T], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in Turnstile rate-limit security test: ${normalizedSql}`);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    const client: DbClient = {
      query: async <R = any>(sql: string, params: unknown[] = []) => this.query<R>(sql, params),
    };
    return callback(client);
  }
}

async function runAuthTurnstileRateLimitSecurityTest() {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalGovhubTurnstileSecret = process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  const originalTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalAllowedHostnames = process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES;
  const originalTurnstileRateLimit = process.env.GOVHUB_TURNSTILE_RATE_LIMIT;
  const originalFetch = globalThis.fetch;

  let upstreamFetchCount = 0;
  (globalThis as any).fetch = async () => {
    upstreamFetchCount += 1;
    return {
      json: async () => ({
        success: true,
        action: 'app_load',
        hostname: 'portal.govhub.test',
      }),
    };
  };

  process.env.NODE_ENV = 'test';
  process.env.GOVHUB_TURNSTILE_SECRET_KEY = '0xrealistic-turnstile-secret';
  delete process.env.TURNSTILE_SECRET_KEY;
  process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES = 'portal.govhub.test';
  process.env.GOVHUB_TURNSTILE_RATE_LIMIT = '2';

  try {
    const router = authRouter(new TurnstileRateLimitDb());
    const responses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      responses.push(await invokeRoute(router, '/human-verification', 'post', {
        params: {},
        headers: {},
        ip: '203.0.113.10',
        body: { turnstile_token: `token-${attempt}` },
      }));
    }

    assert.equal(responses[0].status, 200);
    assert.equal(responses[1].status, 200);
    assert.equal(responses[2].status, 429);
    assert.equal(responses[2].body.code, 'HUMAN_VERIFICATION_RATE_LIMITED');
    assert.equal(
      upstreamFetchCount,
      2,
      'human verification rate limiting must reject excess requests before calling the upstream Turnstile verifier.',
    );
  } finally {
    (globalThis as any).fetch = originalFetch;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalGovhubTurnstileSecret === undefined) delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
    else process.env.GOVHUB_TURNSTILE_SECRET_KEY = originalGovhubTurnstileSecret;
    if (originalTurnstileSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalTurnstileSecret;
    if (originalAllowedHostnames === undefined) delete process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.GOVHUB_TURNSTILE_ALLOWED_HOSTNAMES = originalAllowedHostnames;
    if (originalTurnstileRateLimit === undefined) delete process.env.GOVHUB_TURNSTILE_RATE_LIMIT;
    else process.env.GOVHUB_TURNSTILE_RATE_LIMIT = originalTurnstileRateLimit;
  }
}

void runAuthTurnstileRateLimitSecurityTest().catch(error => {
  console.error(error);
  process.exit(1);
});
