import type { Db, DbClient } from './db';
import { exec, one, run } from './db';

/**
 * Persistent PostgreSQL-backed rate limiter.
 *
 * Survives process restarts and works correctly in any single-node deployment.
 * Each bucket is keyed by an arbitrary string (IP, API key hash, etc.) and a
 * named limit group so different limits can share the same table.
 */

export async function ensureRateLimitSchema(db: DbClient) {
  await exec(db, `
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket_key TEXT NOT NULL,
      limit_group TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      reset_at TEXT NOT NULL,
      PRIMARY KEY (bucket_key, limit_group)
    );
  `);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * Atomically consume one unit from a rate-limit bucket.
 *
 * @param db          PostgreSQL database instance
 * @param group       Name of this limit (e.g. 'login', 'sandbox')
 * @param key         Bucket key (e.g. 'ip:email', api key hash)
 * @param limit       Maximum allowed calls per window
 * @param windowMs    Window duration in milliseconds
 * @param now         Current timestamp in ms (injectable for tests)
 */
export function consumeRateLimit(
  db: Db,
  group: string,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  const nowIso = new Date(now).toISOString();
  const resetAtIso = new Date(now + windowMs).toISOString();

  const consume = db.transaction(async (client): Promise<RateLimitResult> => {
    const row = await one<{ count: number; reset_at: string }>(
      client,
      'SELECT count, reset_at FROM rate_limits WHERE bucket_key = $1 AND limit_group = $2',
      [key, group],
    );

    // Window has expired or no row exists — start fresh
    if (!row || row.reset_at <= nowIso) {
      await run(client, `
        INSERT INTO rate_limits (bucket_key, limit_group, count, reset_at)
        VALUES ($1, $2, 1, $3)
        ON CONFLICT(bucket_key, limit_group) DO UPDATE SET
          count = 1,
          reset_at = excluded.reset_at
      `, [key, group, resetAtIso]);
      const resetMs = new Date(resetAtIso).getTime();
      return { allowed: true, remaining: limit - 1, resetAt: resetMs };
    }

    const resetMs = new Date(row.reset_at).getTime();

    if (row.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: resetMs };
    }

    await run(client, 'UPDATE rate_limits SET count = count + 1 WHERE bucket_key = $1 AND limit_group = $2', [key, group]);

    return { allowed: true, remaining: limit - row.count - 1, resetAt: resetMs };
  });

  return consume;
}

/**
 * Remove a rate-limit record entirely (e.g. after a successful login).
 */
export async function clearRateLimit(db: DbClient, group: string, key: string) {
  await run(db, 'DELETE FROM rate_limits WHERE bucket_key = $1 AND limit_group = $2', [key, group]);
}

/**
 * Purge expired rows. Call periodically (e.g. on startup or via a cron-like interval).
 */
export async function purgeExpiredRateLimits(db: DbClient, now = Date.now()) {
  await run(db, 'DELETE FROM rate_limits WHERE reset_at <= $1', [new Date(now).toISOString()]);
}
