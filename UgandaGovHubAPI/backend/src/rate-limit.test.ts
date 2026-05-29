import assert from 'assert/strict';
import { consumeRateLimit, ensureRateLimitSchema } from './rate-limit';
import { withPostgresTestDb } from './postgres-test-db';

async function main() {
  await withPostgresTestDb(async db => {
    await ensureRateLimitSchema(db);

    const first = await consumeRateLimit(db, 'test', 'client-a', 2, 60_000, 1_000);
    const second = await consumeRateLimit(db, 'test', 'client-a', 2, 60_000, 2_000);
    const third = await consumeRateLimit(db, 'test', 'client-a', 2, 60_000, 3_000);
    const reset = await consumeRateLimit(db, 'test', 'client-a', 2, 60_000, 62_000);

    assert.deepEqual(first, { allowed: true, remaining: 1, resetAt: 61_000 });
    assert.deepEqual(second, { allowed: true, remaining: 0, resetAt: 61_000 });
    assert.deepEqual(third, { allowed: false, remaining: 0, resetAt: 61_000 });
    assert.deepEqual(reset, { allowed: true, remaining: 1, resetAt: 122_000 });
  });

  console.log('rate limit tests passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
