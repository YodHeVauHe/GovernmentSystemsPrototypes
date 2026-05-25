import type Database from 'better-sqlite3';
import { generatePublicId } from './ids';

// Cache whether the consumer_user_id column exists so we don't run PRAGMA on every write.
// The column is added by ensureAdminSchema() at startup, so after that it's stable.
let _hasConsumerUserIdCol: boolean | null = null;

function hasConsumerUserIdColumn(db: Database.Database): boolean {
  if (_hasConsumerUserIdCol === null) {
    const columns = db.prepare('PRAGMA table_info(audit_logs)').all() as Array<{ name: string }>;
    _hasConsumerUserIdCol = columns.some(column => column.name === 'consumer_user_id');
  }
  return _hasConsumerUserIdCol;
}

/** Call this once after schema migrations complete to warm the cache. */
export function initAuditColumnCache(db: Database.Database) {
  _hasConsumerUserIdCol = null; // reset so the next call re-detects
  hasConsumerUserIdColumn(db);  // prime the cache
}

export function logAuditEvent(
  db: Database.Database,
  eventType: string,
  mdaId: string | null,
  apiId: string | null,
  requestId: string,
  details: any
) {
  try {
    const id = generatePublicId('audit');
    const consumerUserId = details?.consumer_user_id || null;

    if (hasConsumerUserIdColumn(db)) {
      db.prepare(`
        INSERT INTO audit_logs (id, event_type, mda_id, consumer_user_id, api_id, request_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, eventType, mdaId, consumerUserId, apiId, requestId, JSON.stringify(details));
      return;
    }

    db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, eventType, mdaId, apiId, requestId, JSON.stringify(details));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
