import assert from 'assert';
import { normalizeSandboxLogPath, redactSandboxLogValue, sandboxMiddleware } from './middleware/sandbox';
import { computeApiKeyHash } from './admin';
import type { Db, DbClient } from './db';

const defaultIdentityApiId = 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6';
const approvedSandboxApiKey = 'govhub_test_key_disabled_static_api';

class SandboxPathResolutionDb implements Db {
  sawUnboundedSandboxMappingQuery = false;
  sandboxApiLookupIds: unknown[] = [];
  disabledSandboxApiIds = new Set<string>();

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql === 'SELECT id, sandbox_available FROM apis WHERE sandbox_available = TRUE') {
      this.sawUnboundedSandboxMappingQuery = true;
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql === 'SELECT id FROM apis WHERE id = $1 AND sandbox_available = TRUE') {
      this.sandboxApiLookupIds.push(params[0]);
      if (this.disabledSandboxApiIds.has(String(params[0]))) {
        return { rows: [], rowCount: 0 };
      }
      return params[0] === 'api-custom-1'
        || params[0] === defaultIdentityApiId
        ? { rows: [{ id: params[0] } as T], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes('FROM access_requests r LEFT JOIN users u ON u.id = r.consumer_user_id WHERE r.api_key_hash = $1')) {
      if (params[0] !== computeApiKeyHash(approvedSandboxApiKey)) {
        return { rows: [], rowCount: 0 };
      }
      return {
        rows: [{
          consumer_mda_id: 'mda-consumer',
          consumer_user_id: 'user-consumer',
          consumer_user_status: 'APPROVED',
          api_id: defaultIdentityApiId,
          status: 'APPROVED',
          api_key_status: 'ACTIVE',
          api_key_expires_at: null,
          api_key_revoked_at: null,
        } as T],
        rowCount: 1,
      };
    }

    if (normalizedSql.includes('INSERT INTO rate_limits')) {
      return { rows: [{ count: 1, reset_at: new Date(Date.now() + 60_000).toISOString() } as T], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in sandbox path resolution security test: ${normalizedSql}`);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(_callback: (client: DbClient) => Promise<T>): Promise<T> {
    throw new Error('Sandbox path resolution security test should not open a transaction.');
  }
}

type MockResponse = {
  statusCode: number;
  body?: unknown;
  headers: Record<string, unknown>;
  locals: Record<string, unknown>;
  setHeader: (name: string, value: unknown) => void;
  getHeader: (name: string) => unknown;
  status: (statusCode: number) => MockResponse;
  json: (body: unknown) => MockResponse;
  once: (_event: string, _handler: () => void) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    headers: {},
    locals: {},
    setHeader(name: string, value: unknown) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    once() {
      return this;
    },
  };
}

async function invokeSandboxMiddleware(db: SandboxPathResolutionDb, originalUrl: string, headers: Record<string, string> = {}) {
  const middleware = sandboxMiddleware(db);
  const req = {
    method: 'GET',
    originalUrl,
    headers,
    body: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = createMockResponse();
  let nextCalled = false;

  await middleware(req as any, res as any, () => {
    nextCalled = true;
  });

  return { res, nextCalled };
}

assert.equal(
  normalizeSandboxLogPath('/api/v1/transport/driving-permit/WP30219/status?trace=1'),
  '/api/v1/transport/driving-permit/[REDACTED]/status?trace=1',
  'canonical driving-permit sandbox paths must redact permit numbers before logging',
);

assert.equal(
  normalizeSandboxLogPath('/api/v1/transport/driving-permit/status/WP30219'),
  '/api/v1/transport/driving-permit/status/[REDACTED]',
  'compatibility driving-permit sandbox paths must keep redacting permit numbers before logging',
);

assert.deepEqual(
  redactSandboxLogValue({
    nationalId: 'CM99021234567X',
    businessRegistrationNumber: '80010001234567',
    taxIdentificationNumber: '1000123456',
  }),
  {
    nationalId: '[REDACTED]',
    businessRegistrationNumber: '[REDACTED]',
    taxIdentificationNumber: '[REDACTED]',
  },
  'sandbox audit redaction must cover common identifier aliases from OpenAPI specs',
);

assert.deepEqual(
  redactSandboxLogValue({
    fullName: 'JOHN DOE',
    givenName: 'JOHN',
    surname: 'DOE',
    dateOfBirth: '1990-01-01',
    contactPhone: '+256700000000',
    emailAddress: 'john.doe@example.com',
    residentialAddress: '1 Kampala Road',
    directors: [
      {
        fullName: 'JANE DOE',
        appointmentDate: '2020-01-12',
      },
    ],
  }),
  {
    fullName: '[REDACTED]',
    givenName: '[REDACTED]',
    surname: '[REDACTED]',
    dateOfBirth: '[REDACTED]',
    contactPhone: '[REDACTED]',
    emailAddress: '[REDACTED]',
    residentialAddress: '[REDACTED]',
    directors: [
      {
        fullName: '[REDACTED]',
        appointmentDate: '2020-01-12',
      },
    ],
  },
  'sandbox audit redaction must cover common PII aliases from request and response examples',
);

void (async () => {
  const db = new SandboxPathResolutionDb();
  const { res, nextCalled } = await invokeSandboxMiddleware(db, '/api/v1/not-registered/status');

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(
    db.sawUnboundedSandboxMappingQuery,
    false,
    'unknown sandbox paths must not scan every sandbox-enabled API before API-key validation',
  );

  const dynamicDb = new SandboxPathResolutionDb();
  const dynamicResult = await invokeSandboxMiddleware(dynamicDb, '/api/v1/sandbox/api-custom-1/status');

  assert.equal(dynamicResult.nextCalled, false);
  assert.equal(dynamicResult.res.statusCode, 401);
  assert.deepEqual(
    dynamicDb.sandboxApiLookupIds,
    ['api-custom-1'],
    'dynamic sandbox paths must verify only the requested API id before API-key validation',
  );
  assert.equal(
    dynamicDb.sawUnboundedSandboxMappingQuery,
    false,
    'dynamic sandbox paths must not scan every sandbox-enabled API before API-key validation',
  );

  const disabledStaticDb = new SandboxPathResolutionDb();
  disabledStaticDb.disabledSandboxApiIds.add(defaultIdentityApiId);
  const disabledStaticResult = await invokeSandboxMiddleware(
    disabledStaticDb,
    '/api/v1/identity/status/CM99021234567X',
    { 'x-govhub-api-key': approvedSandboxApiKey },
  );

  assert.equal(
    disabledStaticResult.nextCalled,
    false,
    'built-in sandbox routes must not execute when the catalog disables sandbox availability for that API',
  );
  assert.equal(disabledStaticResult.res.statusCode, 403);
  assert.deepEqual(
    disabledStaticDb.sandboxApiLookupIds,
    [defaultIdentityApiId],
    'built-in sandbox routes must verify the mapped API is still sandbox-enabled before accepting a key',
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
