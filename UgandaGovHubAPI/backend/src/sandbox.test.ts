import assert from 'assert/strict';
import { redactSandboxLogValue, normalizeSandboxLogPath, sandboxMiddleware } from './middleware/sandbox';
import { withPostgresTestDb } from './postgres-test-db';

async function main() {
  assert.deepEqual(
    redactSandboxLogValue({
      person: {
        nin: 'CM123456789012',
        details: [{ tin: '1000123456' }],
      },
      password: 'SecretPass123!',
      ordinary: 'keep',
    }),
    {
      person: {
        nin: 'CM12******12',
        details: [{ tin: '10****56' }],
      },
      password: '[REDACTED]',
      ordinary: 'keep',
    }
  );

  assert.equal(
    normalizeSandboxLogPath('/api/v1/identity/verify?nin=CM123456789012&tin=1000123456&status=valid'),
    '/api/v1/identity/verify?nin=%5BREDACTED%5D&tin=%5BREDACTED%5D&status=valid'
  );

  await withPostgresTestDb(async db => {
    await db.exec(`
      CREATE TEMP TABLE apis (id TEXT PRIMARY KEY, sandbox_available BOOLEAN);
      CREATE TEMP TABLE audit_logs (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        mda_id TEXT,
        consumer_user_id TEXT,
        api_id TEXT,
        request_id TEXT,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.prepare('INSERT INTO apis (id, sandbox_available) VALUES (?, ?)').run('api-nira-01', true);

    const responseHeaders = new Map<string, unknown>();
    let statusCode = 0;
    let responseBody: any = null;
    await sandboxMiddleware(db)({
      method: 'GET',
      originalUrl: '/api/v1/identity/status/CM123456789012?tin=1000123456&status=valid',
      headers: {},
      body: {},
      ip: '127.0.0.1',
      socket: {},
    } as any, {
      locals: {},
      setHeader(name: string, value: unknown) {
        responseHeaders.set(name, value);
      },
      getHeader(name: string) {
        return responseHeaders.get(name);
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
    } as any, () => {
      throw new Error('middleware should stop missing API keys');
    });

    assert.equal(statusCode, 401);
    assert.equal(responseBody.error.code, 'MISSING_API_KEY');
    const auditLog = await db.prepare('SELECT details FROM audit_logs WHERE event_type = ?').get<{ details: string }>('SANDBOX_CALL_DENIED');
    const auditDetails = JSON.parse(auditLog?.details || '{}');
    assert.equal(
      auditDetails.path,
      '/api/v1/identity/status/[REDACTED]?tin=%5BREDACTED%5D&status=valid'
    );
    assert.equal(auditDetails.path.includes('CM123456789012'), false);
    assert.equal(auditDetails.path.includes('1000123456'), false);
  });
}

main().then(() => {
  console.log('sandbox tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
