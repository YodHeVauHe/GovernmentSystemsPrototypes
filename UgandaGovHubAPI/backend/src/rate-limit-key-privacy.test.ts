import assert from 'assert/strict';
import { clearRateLimit, consumeRateLimit } from './rate-limit';
import type { Db } from './db';

function createCapturingRateLimitDb() {
  const capturedParams: unknown[][] = [];

  function result(rows: any[], rowCount = rows.length) {
    return { rows, rowCount };
  }

  const db = {
    async query(sql: string, params: unknown[] = []) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();
      capturedParams.push(params);

      if (normalizedSql.startsWith('INSERT INTO rate_limits')) {
        return result([{ count: 1, reset_at: '2026-05-30T00:01:00.000Z' }]);
      }
      if (normalizedSql.startsWith('DELETE FROM rate_limits')) {
        return result([], 1);
      }

      throw new Error(`Unexpected SQL in rate limit key privacy test: ${normalizedSql}`);
    },
    async exec() {},
    async transaction(callback) {
      return callback(db);
    },
    async close() {},
  } as Db;

  return {
    db,
    capturedParams: () => capturedParams,
  };
}

async function main() {
  const rawKey = `192.0.2.15:${'user.with.long.identifier+'.repeat(80)}@example.go.ug`;
  const fake = createCapturingRateLimitDb();

  await consumeRateLimit(fake.db, 'login', rawKey, 10, 60_000, Date.parse('2026-05-30T00:00:00.000Z'));
  await clearRateLimit(fake.db, 'login', rawKey);

  const consumeBucketKey = fake.capturedParams()[0][0];
  const clearBucketKey = fake.capturedParams()[1][0];

  assert.equal(typeof consumeBucketKey, 'string');
  assert.equal(consumeBucketKey, clearBucketKey);
  assert.notEqual(consumeBucketKey, rawKey);
  assert.equal(String(consumeBucketKey).includes('@example.go.ug'), false);
  assert.equal(String(consumeBucketKey).length <= 80, true);
}

main().then(() => {
  console.log('rate limit key privacy tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
