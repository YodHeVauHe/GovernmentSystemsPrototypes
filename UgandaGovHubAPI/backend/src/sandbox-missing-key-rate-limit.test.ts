import assert from 'assert/strict';
import type { Db } from './db';

type ResponseCapture = {
  statusCode: number;
  body: any;
  headers: Map<string, unknown>;
};

function createRateLimitDb() {
  const rateLimitCounts = new Map<string, number>();
  const auditEvents: any[] = [];

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('INSERT INTO rate_limits')) {
        const bucketKey = String(params[0]);
        const limitGroup = String(params[1]);
        const mapKey = `${limitGroup}:${bucketKey}`;
        const count = (rateLimitCounts.get(mapKey) || 0) + 1;
        rateLimitCounts.set(mapKey, count);
        return result([{ count, reset_at: params[2] }]);
      }
      if (normalizedSql.includes('information_schema.columns')) {
        return result([{ exists: true }]);
      }
      if (normalizedSql.includes('INSERT INTO audit_logs')) {
        auditEvents.push({
          event_type: params[1],
          mda_id: params[2],
          consumer_user_id: params[3],
          api_id: params[4],
          request_id: params[5],
          details: JSON.parse(String(params[6] || '{}')),
        });
        return result([], 1);
      }
      throw new Error(`Unexpected SQL: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return { db, auditEvents };
}

async function callMissingKey(middleware: any, db: Db): Promise<ResponseCapture> {
  const capture: ResponseCapture = {
    statusCode: 0,
    body: null,
    headers: new Map(),
  };

  await middleware(db)({
    method: 'GET',
    originalUrl: '/api/v1/identity/status/CM123456789012',
    headers: {},
    body: {},
    ip: '203.0.113.10',
    socket: {},
  } as any, {
    locals: {},
    setHeader(name: string, value: unknown) {
      capture.headers.set(name, value);
    },
    getHeader(name: string) {
      return capture.headers.get(name);
    },
    status(code: number) {
      capture.statusCode = code;
      return this;
    },
    json(body: any) {
      capture.body = body;
      return this;
    },
  } as any, () => {
    throw new Error('middleware should stop missing API keys');
  });

  return capture;
}

async function main() {
  process.env.GOVHUB_INVALID_SANDBOX_RATE_LIMIT = '2';
  const { sandboxMiddleware } = await import('./middleware/sandbox');
  const { db, auditEvents } = createRateLimitDb();

  const originalConsoleLog = console.log;
  console.log = () => undefined;
  let first: ResponseCapture;
  let second: ResponseCapture;
  let third: ResponseCapture;
  try {
    first = await callMissingKey(sandboxMiddleware, db);
    second = await callMissingKey(sandboxMiddleware, db);
    third = await callMissingKey(sandboxMiddleware, db);
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(first.statusCode, 401);
  assert.equal(first.body.error.code, 'MISSING_API_KEY');
  assert.equal(second.statusCode, 401);
  assert.equal(second.body.error.code, 'MISSING_API_KEY');
  assert.equal(third.statusCode, 429);
  assert.equal(third.body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.equal(third.headers.get('X-RateLimit-Limit'), '2');
  assert.equal(auditEvents.length, 2);
  assert.equal(auditEvents.every(event => event.event_type === 'SANDBOX_CALL_DENIED'), true);
}

main().then(() => {
  console.log('sandbox missing key rate limit tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
