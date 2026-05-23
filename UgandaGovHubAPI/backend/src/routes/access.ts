import { Router } from 'express';
import type Database from 'better-sqlite3';
import { logAuditEvent } from '../audit';
import { generateApiKey, generatePublicId } from '../ids';
import { normalizeExpiryInput } from '../admin';
import { requireAuth } from '../auth';
import { buildAccessRequestList, canReviewAccessRequest, canSubmitAccessRequest, listAuditLogs, resolveConsumerMdaForRequest } from '../access-control';

export function accessRouter(db: Database.Database) {
const router = Router();

// Create an access request (Simulates Developer action)
router.post('/', requireAuth(db, ['developer', 'admin']), (req, res) => {
  const { api_id, consumer_mda_id, purpose, requested_fields, volume_tier, legal_basis, environment } = req.body;
  
  if (!api_id || !purpose) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const mdaDecision = resolveConsumerMdaForRequest(req.user!, consumer_mda_id);
  if (!mdaDecision.allowed) {
    return res.status(403).json({ error: mdaDecision.message, code: mdaDecision.code });
  }
  const apiDecision = canSubmitAccessRequest(db, api_id);
  if (!apiDecision.allowed) {
    return res.status(404).json({ error: apiDecision.message, code: apiDecision.code });
  }

  const id = generatePublicId('req');
  
  try {
    const stmt = db.prepare(`
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_user_id, consumer_type, api_id, purpose,
        status, requested_fields, volume_tier, legal_basis, environment
      ) 
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      mdaDecision.mdaId || null,
      mdaDecision.userId || null,
      mdaDecision.consumerType || 'mda',
      api_id,
      purpose,
      requested_fields || null,
      volume_tier || null,
      legal_basis || null,
      environment || 'sandbox'
    );

    // Log the audit event
    logAuditEvent(db, 'ACCESS_REQUESTED', mdaDecision.mdaId || mdaDecision.userId!, api_id, id, {
      purpose,
      requested_fields,
      volume_tier,
      legal_basis,
      environment
    });

    res.json({ id, status: 'PENDING' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// List all access requests (Simulates Admin action)
router.get('/', requireAuth(db, ['admin', 'api_owner', 'reviewer', 'developer']), (req, res) => {
  try {
    res.json(buildAccessRequestList(db, req.user!));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve an access request (Simulates Admin action)
router.post('/:id/approve', requireAuth(db, ['admin', 'api_owner']), (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};
  const apiKey = generateApiKey();

  try {
    const expiresAt = normalizeExpiryInput(api_key_expires_at);
    // Get the request details first for logging
    const requestRecord = db.prepare('SELECT consumer_mda_id, api_id FROM access_requests WHERE id = ?').get(id) as any;
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const reviewDecision = canReviewAccessRequest(db, req.user!, id);
    if (!reviewDecision.allowed) {
      return res.status(403).json({ error: reviewDecision.message, code: reviewDecision.code });
    }

    const stmt = db.prepare(`
      UPDATE access_requests 
      SET status = 'APPROVED', api_key = ?, api_key_status = 'ACTIVE', api_key_expires_at = ?, api_key_revoked_at = NULL
      WHERE id = ?
    `);
    stmt.run(apiKey, expiresAt, id);
    
    // Log audit events
    logAuditEvent(db, 'ACCESS_APPROVED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      request_id: id
    });
    logAuditEvent(db, 'API_KEY_GENERATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: apiKey.substring(0, 15) + '...',
      api_key_expires_at: expiresAt
    });

    res.json({ id, status: 'APPROVED', api_key: apiKey, api_key_status: 'ACTIVE', api_key_expires_at: expiresAt });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to approve request: ${err.message}` });
  }
});

router.patch('/:id/key-expiry', requireAuth(db, ['admin']), (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};

  try {
    const requestRecord = db.prepare('SELECT consumer_mda_id, api_id, api_key FROM access_requests WHERE id = ?').get(id) as any;
    if (!requestRecord || !requestRecord.api_key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const expiresAt = normalizeExpiryInput(api_key_expires_at);
    db.prepare('UPDATE access_requests SET api_key_expires_at = ?, api_key_status = ? WHERE id = ?')
      .run(expiresAt, 'ACTIVE', id);
    logAuditEvent(db, 'API_KEY_EXPIRY_UPDATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_expires_at: expiresAt
    });

    res.json({ id, api_key_status: 'ACTIVE', api_key_expires_at: expiresAt });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to update API key expiry: ${err.message}` });
  }
});

router.post('/:id/revoke-key', requireAuth(db, ['admin']), (req, res) => {
  const id = String(req.params.id);

  try {
    const requestRecord = db.prepare('SELECT consumer_mda_id, api_id, api_key FROM access_requests WHERE id = ?').get(id) as any;
    if (!requestRecord || !requestRecord.api_key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const revokedAt = new Date().toISOString();
    db.prepare("UPDATE access_requests SET api_key_status = 'REVOKED', api_key_revoked_at = ? WHERE id = ?").run(revokedAt, id);
    logAuditEvent(db, 'API_KEY_REVOKED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: requestRecord.api_key.substring(0, 15) + '...',
      api_key_revoked_at: revokedAt
    });

    res.json({ id, api_key_status: 'REVOKED', api_key_revoked_at: revokedAt });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to revoke API key: ${err.message}` });
  }
});

router.delete('/:id/key', requireAuth(db, ['admin']), (req, res) => {
  const id = String(req.params.id);

  try {
    const requestRecord = db.prepare('SELECT consumer_mda_id, api_id, api_key FROM access_requests WHERE id = ?').get(id) as any;
    if (!requestRecord || !requestRecord.api_key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    db.prepare("UPDATE access_requests SET api_key = NULL, api_key_status = 'DELETED', api_key_revoked_at = ?, api_key_expires_at = NULL WHERE id = ?")
      .run(new Date().toISOString(), id);
    logAuditEvent(db, 'API_KEY_DELETED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: requestRecord.api_key.substring(0, 15) + '...'
    });

    res.json({ id, api_key_status: 'DELETED' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to delete API key: ${err.message}` });
  }
});

// Post an Audit Log Entry
router.post('/audit-logs', requireAuth(db, ['admin']), (req, res) => {
  const { eventType, mdaId, apiId, requestId, details } = req.body;
  try {
    logAuditEvent(db, eventType, mdaId, apiId, requestId, details);
    res.status(201).json({ status: 'logged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// Get Audit Logs
router.get('/audit-logs', requireAuth(db, ['admin', 'reviewer', 'developer']), (req, res) => {
  try {
    res.json(listAuditLogs(db, req.user!));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to fetch audit logs: ${err.message}` });
  }
});

// Get Access Matrix
router.get('/matrix', requireAuth(db, ['admin', 'reviewer']), (req, res) => {
  try {
    const permissions = db.prepare(`
      SELECT consumer_mda_id, api_id, status 
      FROM access_requests 
      WHERE status = 'APPROVED'
        AND api_key IS NOT NULL
        AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
        AND (api_key_expires_at IS NULL OR api_key_expires_at > ?)
    `).all(new Date().toISOString());
    res.json(permissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch access matrix' });
  }
});
return router;
}
