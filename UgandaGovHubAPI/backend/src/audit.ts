import crypto from 'crypto';
import type Database from 'better-sqlite3';

export function logAuditEvent(
  db: Database.Database,
  eventType: string,
  mdaId: string | null,
  apiId: string | null,
  requestId: string,
  details: any
) {
  try {
    const id = `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, request_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, eventType, mdaId, apiId, requestId, JSON.stringify(details));
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
