import assert from 'assert';
import type { QueryResultRow } from 'pg';
import { buildAccessRequestList, listAuditLogs } from './access-control';
import type { AuthUser } from './auth';
import type { DbClient } from './db';
import { accessRouter } from './routes/access';

type QueryCall = {
  sql: string;
  params?: unknown[];
};

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

  return { status: res.statusCode, body: res.body };
}

const reviewerUser: AuthUser = {
  id: 'usr-reviewer',
  full_name: 'Platform Reviewer',
  email: 'reviewer@example.go.ug',
  password_hash: 'scrypt:salt:hash',
  account_type: 'government_employee',
  requested_role: 'reviewer',
  requested_mda_id: null,
  requested_organization: 'Review Office',
  requested_purpose: 'Review access',
  status: 'APPROVED',
  role: 'reviewer',
  mda_id: 'mda-review',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

function createAuditLogDb() {
  const calls: QueryCall[] = [];
  const db: DbClient = {
    async query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
      calls.push({ sql, params });
      const isCountQuery = /\bCOUNT\(\*\)/i.test(sql);
      const isSandboxAuditQuery = /event_type LIKE 'SANDBOX_CALL%'/i.test(sql);
      const isActorScoped = /consumer_user_id\s*=\s*\$1/i.test(sql) || /mda_id\s*=\s*\$2/i.test(sql);

      if (isCountQuery) {
        return {
          rows: [{ count: isSandboxAuditQuery && !isActorScoped ? '2' : '0' }] as unknown as T[],
          rowCount: 1,
        };
      }

      if (isSandboxAuditQuery && !isActorScoped) {
        return {
          rows: [
            { id: 'audit-1', event_type: 'SANDBOX_CALL_ALLOWED' },
            { id: 'audit-2', event_type: 'SANDBOX_CALL_DENIED' },
          ] as unknown as T[],
          rowCount: 2,
        };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  return { db, calls };
}

function createAccessRequestListDb() {
  const calls: QueryCall[] = [];
  const db: DbClient = {
    async query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
      calls.push({ sql, params });
      return {
        rows: [
          {
            id: 'req-1',
            status: 'APPROVED',
            api_name: 'Identity Verification',
            consumer_name: 'Demo MDA',
          },
        ] as unknown as T[],
        rowCount: 1,
      };
    },
  };

  return { db, calls };
}

function createAccessMatrixDb() {
  const calls: QueryCall[] = [];
  const db: DbClient = {
    async query<T extends QueryResultRow = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
      calls.push({ sql, params });
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [reviewerUser] as unknown as T[], rowCount: 1 };
      }
      if (/FROM access_requests/i.test(sql)) {
        return {
          rows: [
            {
              consumer_mda_id: 'mda-consumer',
              consumer_user_id: null,
              consumer_type: 'mda',
              api_id: 'api-identity',
              status: 'APPROVED',
              api_key_expires_at: null,
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }
      throw new Error(`Unexpected SQL in access matrix security test: ${sql.replace(/\s+/g, ' ').trim()}`);
    },
  };

  return { db, calls };
}

async function runAccessControlSecurityTests() {
  const accessMatrix = createAccessMatrixDb();
  const matrixResponse = await invokeRoute(accessRouter(accessMatrix.db), '/matrix', 'get', {
    params: {},
    query: { limit: '1000000', offset: '-5' },
    headers: { authorization: 'Bearer reviewer-session' },
    body: {},
    ip: '127.0.0.1',
  });
  assert.equal(matrixResponse.status, 200);
  const accessMatrixQuery = accessMatrix.calls.find(call => /FROM access_requests/i.test(call.sql));
  assert.ok(accessMatrixQuery, 'Expected access matrix query to run.');
  assert.match(
    accessMatrixQuery!.sql,
    /\bLIMIT\b.+\bOFFSET\b/i,
    'Access matrix listing must use bounded LIMIT/OFFSET pagination.',
  );
  assert.deepEqual(
    accessMatrixQuery!.params?.slice(-2),
    [100, 0],
    'Access matrix listing must cap oversized limits and normalize negative offsets.',
  );

  const accessList = createAccessRequestListDb();
  await (buildAccessRequestList as any)(accessList.db, { id: 'usr-admin', role: 'admin', mda_id: null }, 1000000, -5);

  const accessRequestListQuery = accessList.calls.find(call => /FROM access_requests r/i.test(call.sql));
  assert.ok(accessRequestListQuery, 'Expected access request list query to run.');
  assert.match(
    accessRequestListQuery!.sql,
    /\bLIMIT\b.+\bOFFSET\b/i,
    'Access request listing must use bounded LIMIT/OFFSET pagination.',
  );
  assert.deepEqual(
    accessRequestListQuery!.params,
    [100, 0],
    'Access request listing must cap oversized limits and normalize negative offsets.',
  );

  const largeOffsetAccessList = createAccessRequestListDb();
  await (buildAccessRequestList as any)(
    largeOffsetAccessList.db,
    { id: 'usr-admin', role: 'admin', mda_id: null },
    100,
    1000000000,
  );
  const largeOffsetQuery = largeOffsetAccessList.calls.find(call => /FROM access_requests r/i.test(call.sql));
  assert.deepEqual(
    largeOffsetQuery?.params,
    [100, 10000],
    'Access request listing must cap oversized offsets.',
  );

  const { db, calls } = createAuditLogDb();

  const page = await listAuditLogs(
    db,
    { id: 'usr-reviewer', role: 'reviewer', mda_id: 'mda-review' },
    50,
    0,
    { scope: 'api-calls' },
  );

  assert.equal(
    page.total,
    2,
    'Reviewer audit-log scope=api-calls must include all sandbox audit events, not just events tied to the reviewer account.',
  );
  assert.deepEqual(
    page.data.map(row => row.id),
    ['audit-1', 'audit-2'],
    'Reviewer audit-log scope=api-calls must return sandbox audit rows across consumers.',
  );

  const filteredQueries = calls.filter(call => /event_type LIKE 'SANDBOX_CALL%'/i.test(call.sql));
  assert.ok(filteredQueries.length >= 2, 'Expected count and data queries to filter by sandbox audit event type.');
  for (const call of filteredQueries) {
    assert.doesNotMatch(
      call.sql,
      /consumer_user_id\s*=\s*\$1|mda_id\s*=\s*\$2/i,
      'Privileged audit-log scope=api-calls queries must not reuse developer actor scoping.',
    );
  }
}

runAccessControlSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
