import { Router } from 'express';
import { logAuditEvent } from '../audit';
import { generateApiKey, generatePublicId } from '../ids';
import { computeApiKeyHash, getApiKeyPreview, normalizeExpiryInput } from '../admin';
import { requireAuth } from '../auth';
import { buildAccessRequestList, canReviewAccessRequest, canSubmitAccessRequest, listAuditLogs, resolveConsumerMdaForRequest } from '../access-control';
import type { DbClient } from '../db';
import { many, one, run } from '../db';

export function accessRouter(db: DbClient) {
const router = Router();

// Create an access request (Simulates Developer action)
router.post('/', requireAuth(db, ['developer', 'admin']), async (req, res) => {
  const { api_id, consumer_mda_id, purpose, requested_fields, volume_tier, legal_basis, environment } = req.body;
  
  if (!api_id || !purpose) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const mdaDecision = resolveConsumerMdaForRequest(req.user!, consumer_mda_id);
  if (mdaDecision.allowed === false) {
    return res.status(403).json({ error: mdaDecision.message, code: mdaDecision.code });
  }
  const apiDecision = await canSubmitAccessRequest(db, api_id);
  if (apiDecision.allowed === false) {
    return res.status(404).json({ error: apiDecision.message, code: apiDecision.code });
  }

  const id = generatePublicId('req');
  
  try {
    await run(db, `
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_user_id, consumer_type, api_id, purpose,
        status, requested_fields, volume_tier, legal_basis, environment
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10)
    `, [
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
    ]);

    // Log the audit event
    await logAuditEvent(db, 'ACCESS_REQUESTED', mdaDecision.mdaId || mdaDecision.userId!, api_id, id, {
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
router.get('/', requireAuth(db, ['admin', 'api_owner', 'reviewer', 'developer']), async (req, res) => {
  try {
    res.json(await buildAccessRequestList(db, req.user!));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve an access request (Simulates Admin action)
router.post('/:id/approve', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};
  const apiKey = generateApiKey();

  try {
    const expiresAt = normalizeExpiryInput(api_key_expires_at);
    // Get the request details first for logging
    const requestRecord = await one(db, 'SELECT consumer_mda_id, api_id FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }
    const reviewDecision = await canReviewAccessRequest(db, req.user!, id);
    if (reviewDecision.allowed === false) {
      return res.status(403).json({ error: reviewDecision.message, code: reviewDecision.code });
    }

    await run(db, `
      UPDATE access_requests 
      SET status = 'APPROVED', api_key = NULL, api_key_hash = $1, api_key_preview = $2, api_key_status = 'ACTIVE', api_key_expires_at = $3, api_key_revoked_at = NULL
      WHERE id = $4
    `, [computeApiKeyHash(apiKey), getApiKeyPreview(apiKey), expiresAt, id]);
    
    // Log audit events
    await logAuditEvent(db, 'ACCESS_APPROVED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      request_id: id
    });
    await logAuditEvent(db, 'API_KEY_GENERATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: getApiKeyPreview(apiKey),
      api_key_expires_at: expiresAt
    });

    res.json({ id, status: 'APPROVED', api_key: apiKey, api_key_status: 'ACTIVE', api_key_expires_at: expiresAt });
  } catch (err: any) {
    console.error('[access approve]', err);
    res.status(500).json({ error: 'Failed to approve request. Please try again.' });
  }
});

router.patch('/:id/key-expiry', requireAuth(db, ['admin']), async (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};

  try {
    const requestRecord = await one(db, 'SELECT consumer_mda_id, api_id, api_key_hash FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const expiresAt = normalizeExpiryInput(api_key_expires_at);
    await run(db, 'UPDATE access_requests SET api_key_expires_at = $1, api_key_status = $2 WHERE id = $3', [expiresAt, 'ACTIVE', id]);
    await logAuditEvent(db, 'API_KEY_EXPIRY_UPDATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_expires_at: expiresAt
    });

    res.json({ id, api_key_status: 'ACTIVE', api_key_expires_at: expiresAt });
  } catch (err: any) {
    console.error('[key-expiry update]', err);
    res.status(500).json({ error: 'Failed to update API key expiry. Please try again.' });
  }
});

router.post('/:id/revoke-key', requireAuth(db, ['admin']), async (req, res) => {
  const id = String(req.params.id);

  try {
    const requestRecord = await one(db, 'SELECT consumer_mda_id, api_id, api_key_hash, api_key_preview FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const revokedAt = new Date().toISOString();
    await run(db, "UPDATE access_requests SET api_key_status = 'REVOKED', api_key_revoked_at = $1 WHERE id = $2", [revokedAt, id]);
    await logAuditEvent(db, 'API_KEY_REVOKED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: requestRecord.api_key_preview,
      api_key_revoked_at: revokedAt
    });

    res.json({ id, api_key_status: 'REVOKED', api_key_revoked_at: revokedAt });
  } catch (err: any) {
    console.error('[key revoke]', err);
    res.status(500).json({ error: 'Failed to revoke API key. Please try again.' });
  }
});

router.delete('/:id/key', requireAuth(db, ['admin']), async (req, res) => {
  const id = String(req.params.id);

  try {
    const requestRecord = await one(db, 'SELECT consumer_mda_id, api_id, api_key_hash, api_key_preview FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await run(db, "UPDATE access_requests SET api_key = NULL, api_key_hash = NULL, api_key_status = 'DELETED', api_key_revoked_at = $1, api_key_expires_at = NULL WHERE id = $2", [new Date().toISOString(), id]);
    await logAuditEvent(db, 'API_KEY_DELETED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: requestRecord.api_key_preview
    });

    res.json({ id, api_key_status: 'DELETED' });
  } catch (err: any) {
    console.error('[key delete]', err);
    res.status(500).json({ error: 'Failed to delete API key. Please try again.' });
  }
});

// Post an Audit Log Entry
router.post('/audit-logs', requireAuth(db, ['admin']), (req, res) => {
  res.status(410).json({ error: 'Manual audit log creation is disabled.', code: 'AUDIT_LOG_MANUAL_WRITE_DISABLED' });
});

// Get Audit Logs
router.get('/audit-logs', requireAuth(db, ['admin', 'reviewer', 'developer']), async (req, res) => {
  try {
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;
    res.json(await listAuditLogs(db, req.user!, limit, offset));
  } catch (err: any) {
    console.error('[audit-logs fetch]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs. Please try again.' });
  }
});

// Get Access Matrix
router.get('/matrix', requireAuth(db, ['admin', 'reviewer']), async (req, res) => {
  try {
    // Include both MDA-type and user-type consumers so the full access picture is visible
    const permissions = await many(db, `
      SELECT
        consumer_mda_id,
        consumer_user_id,
        consumer_type,
        api_id,
        status,
        api_key_expires_at
      FROM access_requests
      WHERE status = 'APPROVED'
        AND api_key_hash IS NOT NULL
        AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
        AND (api_key_expires_at IS NULL OR api_key_expires_at > $1)
    `, [new Date().toISOString()]);
    res.json(permissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch access matrix' });
  }
});
return router;
}
