import type Database from 'better-sqlite3';

/**
 * Persistent SQLite-backed rate limiter.
 *
 * Survives process restarts and works correctly in any single-node deployment.
 * Each bucket is keyed by an arbitrary string (IP, API key hash, etc.) and a
 * named limit group so different limits can share the same table.
 */

export function ensureRateLimitSchema(db: Database.Database) {
  db.exec(`
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
 * @param db          SQLite database instance
 * @param group       Name of this limit (e.g. 'login', 'sandbox')
 * @param key         Bucket key (e.g. 'ip:email', api key hash)
 * @param limit       Maximum allowed calls per window
 * @param windowMs    Window duration in milliseconds
 * @param now         Current timestamp in ms (injectable for tests)
 */
export function consumeRateLimit(
  db: Database.Database,
  group: string,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const nowIso = new Date(now).toISOString();
  const resetAtIso = new Date(now + windowMs).toISOString();

  const consume = db.transaction((): RateLimitResult => {
    const row = db.prepare(
      'SELECT count, reset_at FROM rate_limits WHERE bucket_key = ? AND limit_group = ?',
    ).get(key, group) as { count: number; reset_at: string } | undefined;

    // Window has expired or no row exists — start fresh
    if (!row || row.reset_at <= nowIso) {
      db.prepare(`
        INSERT INTO rate_limits (bucket_key, limit_group, count, reset_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(bucket_key, limit_group) DO UPDATE SET
          count = 1,
          reset_at = excluded.reset_at
      `).run(key, group, resetAtIso);
      const resetMs = new Date(resetAtIso).getTime();
      return { allowed: true, remaining: limit - 1, resetAt: resetMs };
    }

    const resetMs = new Date(row.reset_at).getTime();

    if (row.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: resetMs };
    }

    db.prepare(
      'UPDATE rate_limits SET count = count + 1 WHERE bucket_key = ? AND limit_group = ?',
    ).run(key, group);

    return { allowed: true, remaining: limit - row.count - 1, resetAt: resetMs };
  });

  return consume();
}

/**
 * Remove a rate-limit record entirely (e.g. after a successful login).
 */
export function clearRateLimit(db: Database.Database, group: string, key: string) {
  db.prepare('DELETE FROM rate_limits WHERE bucket_key = ? AND limit_group = ?').run(key, group);
}

/**
 * Purge expired rows. Call periodically (e.g. on startup or via a cron-like interval).
 */
export function purgeExpiredRateLimits(db: Database.Database, now = Date.now()) {
  db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?').run(new Date(now).toISOString());
}
