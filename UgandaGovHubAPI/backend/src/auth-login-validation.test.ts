import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import type { Db } from './db';
import { authRouter } from './routes/auth';

function createLoginValidationDb() {
  let rateLimitAttempts = 0;
  let userLookups = 0;

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      if (normalizedSql.includes('INSERT INTO rate_limits')) {
        rateLimitAttempts += 1;
        return result([{ count: 1, reset_at: '2026-05-30T00:15:00.000Z' }]);
      }
      if (normalizedSql.includes('SELECT * FROM users WHERE email = $1')) {
        userLookups += 1;
        return result([]);
      }
      throw new Error(`Unexpected SQL in auth login validation test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    rateLimitAttempts: () => rateLimitAttempts,
    userLookups: () => userLookups,
  };
}

async function request(baseUrl: string, body: unknown) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  return { response, body: responseBody };
}

async function withApp<T>(db: Db, callback: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(db));

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await close(server);
  }
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main() {
  const originalTurnstileSecret = process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  const originalLegacyTurnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;

  try {
    const malformedEmailFixture = createLoginValidationDb();
    await withApp(malformedEmailFixture.db, async baseUrl => {
      const login = await request(baseUrl, {
        email: { value: 'admin@example.go.ug' },
        password: 'AdminPass123!',
      });

      assert.equal(login.response.status, 400);
      assert.equal(login.body.code, 'INVALID_LOGIN_INPUT');
      assert.equal(malformedEmailFixture.rateLimitAttempts(), 0);
      assert.equal(malformedEmailFixture.userLookups(), 0);
    });

    const malformedPasswordFixture = createLoginValidationDb();
    await withApp(malformedPasswordFixture.db, async baseUrl => {
      const login = await request(baseUrl, {
        email: 'admin@example.go.ug',
        password: ['AdminPass123!'],
      });

      assert.equal(login.response.status, 400);
      assert.equal(login.body.code, 'INVALID_LOGIN_INPUT');
      assert.equal(malformedPasswordFixture.rateLimitAttempts(), 0);
      assert.equal(malformedPasswordFixture.userLookups(), 0);
    });
  } finally {
    if (originalTurnstileSecret === undefined) {
      delete process.env.GOVHUB_TURNSTILE_SECRET_KEY;
    } else {
      process.env.GOVHUB_TURNSTILE_SECRET_KEY = originalTurnstileSecret;
    }
    if (originalLegacyTurnstileSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalLegacyTurnstileSecret;
    }
  }
}

main().then(() => {
  console.log('auth login validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
