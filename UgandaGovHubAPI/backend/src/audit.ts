import type Database from 'better-sqlite3';
import { generatePublicId } from './ids';

export function logAuditEvent(
  db: Database.Database,
  eventType: string,
  mdaId: string | null,
  apiId: string | null,
  requestId: string,
  details: any
) {
  try {
    const columns = db.prepare('PRAGMA table_info(audit_logs)').all() as Array<{ name: string }>;
    const hasConsumerUserId = columns.some(column => column.name === 'consumer_user_id');
    const id = generatePublicId('audit');
    const consumerUserId = details?.consumer_user_id || null;

    if (hasConsumerUserId) {
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, event_type, mda_id, consumer_user_id, api_id, request_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, eventType, mdaId, consumerUserId, apiId, requestId, JSON.stringify(details));
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, eventType, mdaId, apiId, requestId, JSON.stringify(details));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
