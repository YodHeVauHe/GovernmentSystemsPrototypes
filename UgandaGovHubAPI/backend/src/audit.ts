import { generatePublicId } from './ids';
import type { DbClient } from './db';
import { hasColumn, run } from './db';

// Cache whether the consumer_user_id column exists so we don't query metadata on every write.
// The column is added by ensureAdminSchema() at startup, so after that it's stable.
let _hasConsumerUserIdCol: boolean | null = null;

async function hasConsumerUserIdColumn(db: DbClient): Promise<boolean> {
  if (_hasConsumerUserIdCol === null) {
    _hasConsumerUserIdCol = await hasColumn(db, 'audit_logs', 'consumer_user_id');
  }
  return _hasConsumerUserIdCol;
}

/** Call this once after schema migrations complete to warm the cache. */
export async function initAuditColumnCache(db: DbClient) {
  _hasConsumerUserIdCol = null; // reset so the next call re-detects
  await hasConsumerUserIdColumn(db);  // prime the cache
}

export async function logAuditEvent(
  db: DbClient,
  eventType: string,
  mdaId: string | null,
  apiId: string | null,
  requestId: string,
  details: any
) {
  try {
    const id = generatePublicId('audit');
    const consumerUserId = details?.consumer_user_id || null;

    if (await hasConsumerUserIdColumn(db)) {
      await run(db, `
        INSERT INTO audit_logs (id, event_type, mda_id, consumer_user_id, api_id, request_id, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [id, eventType, mdaId, consumerUserId, apiId, requestId, JSON.stringify(details)]);
      return;
    }

    await run(db, `
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, eventType, mdaId, apiId, requestId, JSON.stringify(details)]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
