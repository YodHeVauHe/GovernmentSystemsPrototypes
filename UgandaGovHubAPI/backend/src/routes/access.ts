import { Router } from 'express';
import { logAuditEvent } from '../audit';
import { generateApiKey, generatePublicId } from '../ids';
import { computeApiKeyHash, getApiKeyPreview, normalizeExpiryInput } from '../admin';
import { requireAuth } from '../auth';
import { buildAccessMatrix, buildAccessRequestList, canReviewAccessRequest, canSubmitAccessRequest, findBlockingAccessRequest, listAuditLogs, resolveConsumerMdaForRequest } from '../access-control';
import { decryptAtRest, encryptAtRest } from '../crypto-at-rest';
import type { DbClient } from '../db';
import { many, one, run } from '../db';

function parseApiKeyExpiry(input?: unknown) {
  try {
    return { ok: true as const, expiresAt: normalizeExpiryInput(input) };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : 'API key expiry must be a valid future ISO date.',
    };
  }
}

function integerQueryParam(value: unknown, fallback: number) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function mdaExists(db: DbClient, mdaId: string) {
  return Boolean(await one(db, 'SELECT id FROM mdas WHERE id = $1', [mdaId]));
}

function isConsumerMdaForeignKeyError(error: any) {
  return error?.code === '23503' && error?.constraint === 'access_requests_consumer_mda_id_fkey';
}

function statusForAccessReviewDecision(code: string) {
  if (code === 'NOT_FOUND') return 404;
  return 403;
}

type AccessRequestInput = {
  api_id: string;
  consumer_mda_id: string | null;
  purpose: string;
  requested_fields: string | null;
  volume_tier: string | null;
  legal_basis: string | null;
  environment: 'sandbox' | 'production';
};

type AccessRequestInputValidation =
  | { ok: true; value: AccessRequestInput }
  | { ok: false; message: string };

const ACCESS_REQUEST_API_ID_MAX_LENGTH = 200;
const ACCESS_REQUEST_CONSUMER_MDA_ID_MAX_LENGTH = 200;
const ACCESS_REQUEST_PURPOSE_MAX_LENGTH = 2000;
const ACCESS_REQUEST_REQUESTED_FIELDS_MAX_LENGTH = 1000;
const ACCESS_REQUEST_LEGAL_BASIS_MAX_LENGTH = 2000;
const ACCESS_REQUEST_VOLUME_TIERS = new Set([
  'Low (< 1,000 / month)',
  'Medium (1,000 - 10,000 / month)',
  'High (> 10,000 / month)',
]);
const ACCESS_REQUEST_ENVIRONMENTS = new Set(['sandbox', 'production']);

function optionalBoundedString(value: unknown, maxLength: number, fieldName: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, message: `${fieldName} must be a string.` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, message: `${fieldName} must be ${maxLength} characters or fewer.` };
  return { ok: true, value: trimmed };
}

function requiredBoundedString(value: unknown, maxLength: number, fieldName: string): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, message: `${fieldName} is required.` };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false, message: `${fieldName} must be ${maxLength} characters or fewer.` };
  return { ok: true, value: trimmed };
}

function validateAccessRequestInput(body: any): AccessRequestInputValidation {
  const apiId = requiredBoundedString(body?.api_id, ACCESS_REQUEST_API_ID_MAX_LENGTH, 'api_id');
  if (!apiId.ok) return apiId;
  const consumerMdaId = optionalBoundedString(body?.consumer_mda_id, ACCESS_REQUEST_CONSUMER_MDA_ID_MAX_LENGTH, 'consumer_mda_id');
  if (!consumerMdaId.ok) return consumerMdaId;
  const purpose = requiredBoundedString(body?.purpose, ACCESS_REQUEST_PURPOSE_MAX_LENGTH, 'purpose');
  if (!purpose.ok) return purpose;
  const requestedFields = optionalBoundedString(body?.requested_fields, ACCESS_REQUEST_REQUESTED_FIELDS_MAX_LENGTH, 'requested_fields');
  if (!requestedFields.ok) return requestedFields;
  const legalBasis = optionalBoundedString(body?.legal_basis, ACCESS_REQUEST_LEGAL_BASIS_MAX_LENGTH, 'legal_basis');
  if (!legalBasis.ok) return legalBasis;
  const volumeTier = optionalBoundedString(body?.volume_tier, 100, 'volume_tier');
  if (!volumeTier.ok) return volumeTier;
  if (volumeTier.value && !ACCESS_REQUEST_VOLUME_TIERS.has(volumeTier.value)) {
    return { ok: false, message: 'volume_tier is invalid.' };
  }
  const environment = optionalBoundedString(body?.environment, 20, 'environment');
  if (!environment.ok) return environment;
  const normalizedEnvironment = environment.value || 'sandbox';
  if (!ACCESS_REQUEST_ENVIRONMENTS.has(normalizedEnvironment)) {
    return { ok: false, message: 'environment is invalid.' };
  }

  return {
    ok: true,
    value: {
      api_id: apiId.value,
      consumer_mda_id: consumerMdaId.value,
      purpose: purpose.value,
      requested_fields: requestedFields.value,
      volume_tier: volumeTier.value,
      legal_basis: legalBasis.value,
      environment: normalizedEnvironment as 'sandbox' | 'production',
    },
  };
}

function accessRequestAlreadyExistsResponse(blockingRequest: { id: string; status: string; api_key_status: string | null }) {
  return {
    error: 'An access request for this API is already pending or active. You can appeal only after an administrator revokes or deletes access.',
    code: 'ACCESS_REQUEST_ALREADY_EXISTS',
    existing_request_id: blockingRequest.id,
    status: blockingRequest.status,
    api_key_status: blockingRequest.api_key_status,
  };
}

function isExpiredApiKey(expiresAt: unknown, nowIso: string) {
  if (!expiresAt) return false;
  const expiryTime = Date.parse(String(expiresAt));
  const nowTime = Date.parse(nowIso);
  return !Number.isFinite(expiryTime) || expiryTime <= nowTime;
}

async function findActiveApprovedAccessRequestExcluding(db: DbClient, requestId: string) {
  return one<{ id: string; status: string; api_key_status: string | null }>(db, `
    SELECT existing.id, existing.status, existing.api_key_status
    FROM access_requests target
    JOIN access_requests existing
      ON existing.api_id = target.api_id
     AND existing.id <> target.id
     AND (
       (target.consumer_mda_id IS NOT NULL AND existing.consumer_mda_id = target.consumer_mda_id)
       OR (target.consumer_mda_id IS NULL AND target.consumer_user_id IS NOT NULL AND existing.consumer_user_id = target.consumer_user_id)
     )
     AND COALESCE(existing.environment, 'sandbox') = COALESCE(target.environment, 'sandbox')
    WHERE target.id = $1
      AND existing.status = 'APPROVED'
      AND existing.api_key_hash IS NOT NULL
      AND COALESCE(existing.api_key_status, 'ACTIVE') = 'ACTIVE'
      AND existing.api_key_revoked_at IS NULL
      AND (existing.api_key_expires_at IS NULL OR existing.api_key_expires_at > $2)
    ORDER BY existing.created_at DESC
    LIMIT 1
  `, [requestId, new Date().toISOString()]);
}

export function accessRouter(db: DbClient) {
const router = Router();

// Create an access request (Simulates Developer action)
router.post('/', requireAuth(db, ['developer']), async (req, res) => {
  const input = validateAccessRequestInput(req.body || {});
  if (!input.ok) {
    return res.status(400).json({ error: input.message, code: 'INVALID_ACCESS_REQUEST' });
  }
  const { api_id, consumer_mda_id, purpose, requested_fields, volume_tier, legal_basis, environment } = input.value;

  const mdaDecision = resolveConsumerMdaForRequest(req.user!, consumer_mda_id);
  if (mdaDecision.allowed === false) {
    const status = mdaDecision.code === 'MDA_REQUIRED' ? 400 : 403;
    return res.status(status).json({ error: mdaDecision.message, code: mdaDecision.code });
  }
  const apiDecision = await canSubmitAccessRequest(db, api_id);
  if (apiDecision.allowed === false) {
    return res.status(404).json({ error: apiDecision.message, code: apiDecision.code });
  }
  if (mdaDecision.mdaId && !(await mdaExists(db, mdaDecision.mdaId))) {
    return res.status(400).json({ error: 'consumer_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
  }

  try {
    const blockingRequest = await findBlockingAccessRequest(db, {
      apiId: api_id,
      consumerMdaId: mdaDecision.mdaId || null,
      consumerUserId: mdaDecision.userId || null,
      environment,
    });
    if (blockingRequest) {
      return res.status(409).json(accessRequestAlreadyExistsResponse(blockingRequest));
    }

    const id = generatePublicId('req');
    const now = new Date().toISOString();

    const createRequest = await run(db, `
      INSERT INTO access_requests (
        id, consumer_mda_id, consumer_user_id, consumer_type, api_id, purpose,
        status, requested_fields, volume_tier, legal_basis, environment
      ) 
      SELECT $1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9, $10
      WHERE ($2::text IS NULL OR EXISTS (SELECT 1 FROM mdas WHERE id = $2))
        AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $3))
        AND EXISTS (SELECT 1 FROM apis WHERE id = $5)
        AND NOT EXISTS (
          SELECT 1
          FROM access_requests existing
          WHERE existing.api_id = $5
            AND (
              ($2::text IS NOT NULL AND existing.consumer_mda_id = $2)
              OR ($2::text IS NULL AND $3::text IS NOT NULL AND existing.consumer_user_id = $3)
            )
            AND COALESCE(existing.environment, 'sandbox') = $10
            AND (
              existing.status = 'PENDING'
              OR (
                existing.status = 'APPROVED'
                AND existing.api_key_hash IS NOT NULL
                AND COALESCE(existing.api_key_status, 'ACTIVE') = 'ACTIVE'
                AND existing.api_key_revoked_at IS NULL
                AND (existing.api_key_expires_at IS NULL OR existing.api_key_expires_at > $11)
              )
            )
        )
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
      environment || 'sandbox',
      now
    ]);
    if (createRequest.changes !== 1) {
      if (mdaDecision.mdaId && !(await mdaExists(db, mdaDecision.mdaId))) {
        return res.status(400).json({ error: 'consumer_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
      }
      const currentBlockingRequest = await findBlockingAccessRequest(db, {
        apiId: api_id,
        consumerMdaId: mdaDecision.mdaId || null,
        consumerUserId: mdaDecision.userId || null,
        environment,
      });
      if (currentBlockingRequest) {
        return res.status(409).json(accessRequestAlreadyExistsResponse(currentBlockingRequest));
      }
      return res.status(404).json({ error: 'The requested API does not exist.', code: 'API_NOT_FOUND' });
    }

    // Log the audit event
    await logAuditEvent(db, 'ACCESS_REQUESTED', mdaDecision.mdaId || null, api_id, id, {
      consumer_user_id: mdaDecision.userId,
      purpose,
      requested_fields,
      volume_tier,
      legal_basis,
      environment
    });

    res.json({ id, status: 'PENDING' });
  } catch (err: any) {
    if (isConsumerMdaForeignKeyError(err)) {
      return res.status(400).json({ error: 'consumer_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// List all access requests (Simulates Admin action)
router.get('/', requireAuth(db, ['admin', 'api_owner', 'reviewer', 'developer']), async (req, res) => {
  try {
    const limit = integerQueryParam(req.query.limit, 100);
    const offset = integerQueryParam(req.query.offset, 0);
    res.json(await buildAccessRequestList(db, req.user!, limit, offset));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.post('/:id/reveal-key', requireAuth(db, ['developer']), async (req, res) => {
  const id = String(req.params.id);
  const consumerUserId = req.user!.id;
  const consumerMdaId = req.user!.mda_id || null;

  try {
    const [claim] = await many(db, `
      WITH claimed AS (
        SELECT
          r.id,
          r.api_key,
          r.api_key_preview,
          r.api_key_expires_at,
          r.api_id,
          r.consumer_mda_id,
          r.consumer_user_id
        FROM access_requests r
        WHERE r.id = $1
          AND (
            r.consumer_user_id = $2
            OR (
              r.consumer_user_id IS NULL
              AND $3::text IS NOT NULL
              AND r.consumer_mda_id = $3
            )
          )
          AND r.status = 'APPROVED'
          AND r.api_key IS NOT NULL
          AND r.api_key_hash IS NOT NULL
          AND COALESCE(r.api_key_status, 'ACTIVE') = 'ACTIVE'
          AND r.api_key_revoked_at IS NULL
          AND (r.api_key_expires_at IS NULL OR r.api_key_expires_at > $4)
      ),
      cleared AS (
        UPDATE access_requests target
        SET api_key = NULL
        FROM claimed
        WHERE target.id = claimed.id
          AND target.api_key IS NOT NULL
          AND target.api_key_hash IS NOT NULL
          AND COALESCE(target.api_key_status, 'ACTIVE') = 'ACTIVE'
          AND target.api_key_revoked_at IS NULL
          AND (target.api_key_expires_at IS NULL OR target.api_key_expires_at > $4)
        RETURNING target.id
      )
      SELECT claimed.*
      FROM claimed
      JOIN cleared ON cleared.id = claimed.id
    `, [id, consumerUserId, consumerMdaId, new Date().toISOString()]);

    if (!claim?.api_key) {
      return res.status(404).json({
        error: 'No one-time API key is available for this access request.',
        code: 'ONE_TIME_KEY_UNAVAILABLE',
      });
    }
    const revealedApiKey = decryptAtRest(claim.api_key);
    if (!revealedApiKey) {
      return res.status(404).json({
        error: 'No one-time API key is available for this access request.',
        code: 'ONE_TIME_KEY_UNAVAILABLE',
      });
    }

    await logAuditEvent(db, 'API_KEY_REVEALED', claim.consumer_mda_id, claim.api_id, id, {
      api_key_preview: claim.api_key_preview,
      consumer_user_id: claim.consumer_user_id || req.user!.id,
    });

    res.json({
      id,
      api_key: revealedApiKey,
      api_key_preview: claim.api_key_preview,
      api_key_expires_at: claim.api_key_expires_at,
    });
  } catch (err: any) {
    console.error('[key reveal]', err);
    res.status(500).json({ error: 'Failed to reveal API key. Please try again.' });
  }
});

// Approve an access request (Simulates Admin action)
router.post('/:id/approve', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};
  const apiKey = generateApiKey();
  const apiKeyPreview = getApiKeyPreview(apiKey);

  try {
    const expiryInput = parseApiKeyExpiry(api_key_expires_at);
    if (!expiryInput.ok) {
      return res.status(400).json({ error: expiryInput.message, code: 'INVALID_API_KEY_EXPIRY' });
    }
    const expiresAt = expiryInput.expiresAt;
    const reviewDecision = await canReviewAccessRequest(db, req.user!, id);
    if (reviewDecision.allowed === false) {
      return res.status(statusForAccessReviewDecision(reviewDecision.code)).json({ error: reviewDecision.message, code: reviewDecision.code });
    }
    // Fetch request details only after authorization; otherwise request IDs become an oracle.
    const requestRecord = await one(db, 'SELECT consumer_mda_id, consumer_user_id, api_id FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord) {
      return res.status(409).json({
        error: 'This access request was already finalized before approval could complete.',
        code: 'REQUEST_ALREADY_FINALIZED',
      });
    }

    const approvalUpdate = await run(db, `
      UPDATE access_requests target
      SET status = 'APPROVED',
          api_key = $1,
          api_key_hash = $2,
          api_key_preview = $3,
          api_key_status = 'ACTIVE',
          api_key_expires_at = $4,
          api_key_revoked_at = NULL
      FROM apis a
      WHERE target.id = $5
        AND a.id = target.api_id
        AND target.status = 'PENDING'
        AND target.api_key IS NULL
        AND target.api_key_hash IS NULL
        AND COALESCE(target.api_key_status, 'ACTIVE') NOT IN ('REVOKED', 'DELETED')
        AND target.api_key_revoked_at IS NULL
        AND ($6 = TRUE OR a.owning_mda_id = $7)
        AND NOT EXISTS (
          SELECT 1
          FROM access_requests existing
          WHERE existing.id <> target.id
            AND existing.api_id = target.api_id
            AND (
              (target.consumer_mda_id IS NOT NULL AND existing.consumer_mda_id = target.consumer_mda_id)
              OR (target.consumer_mda_id IS NULL AND target.consumer_user_id IS NOT NULL AND existing.consumer_user_id = target.consumer_user_id)
            )
            AND COALESCE(existing.environment, 'sandbox') = COALESCE(target.environment, 'sandbox')
            AND existing.status = 'APPROVED'
            AND existing.api_key_hash IS NOT NULL
            AND COALESCE(existing.api_key_status, 'ACTIVE') = 'ACTIVE'
            AND existing.api_key_revoked_at IS NULL
            AND (existing.api_key_expires_at IS NULL OR existing.api_key_expires_at > $8)
        )
    `, [
      encryptAtRest(apiKey),
      computeApiKeyHash(apiKey),
      apiKeyPreview,
      expiresAt,
      id,
      req.user!.role === 'admin',
      req.user!.mda_id,
      new Date().toISOString(),
    ]);
    if (approvalUpdate.changes !== 1) {
      const duplicateActiveAccess = await findActiveApprovedAccessRequestExcluding(db, id);
      if (duplicateActiveAccess) {
        return res.status(409).json(accessRequestAlreadyExistsResponse(duplicateActiveAccess));
      }
      return res.status(409).json({
        error: 'This access request was already finalized before approval could complete.',
        code: 'REQUEST_ALREADY_FINALIZED',
      });
    }
    
    // Log audit events
    await logAuditEvent(db, 'ACCESS_APPROVED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      consumer_user_id: requestRecord.consumer_user_id,
      request_id: id
    });
    await logAuditEvent(db, 'API_KEY_GENERATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      consumer_user_id: requestRecord.consumer_user_id,
      api_key_preview: apiKeyPreview,
      api_key_expires_at: expiresAt
    });

    res.json({
      id,
      status: 'APPROVED',
      api_key_preview: apiKeyPreview,
      api_key_pending_reveal: true,
      api_key_status: 'ACTIVE',
      api_key_expires_at: expiresAt,
    });
  } catch (err: any) {
    console.error('[access approve]', err);
    res.status(500).json({ error: 'Failed to approve request. Please try again.' });
  }
});

router.patch('/:id/key-expiry', requireAuth(db, ['admin']), async (req, res) => {
  const id = String(req.params.id);
  const { api_key_expires_at } = req.body || {};

  try {
    const now = new Date().toISOString();
    const requestRecord = await one(db, 'SELECT consumer_mda_id, consumer_user_id, api_id, api_key_hash, api_key_status, api_key_revoked_at, api_key_expires_at FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }
    if (
      (requestRecord.api_key_status || 'ACTIVE') !== 'ACTIVE' ||
      requestRecord.api_key_revoked_at ||
      isExpiredApiKey(requestRecord.api_key_expires_at, now)
    ) {
      return res.status(409).json({
        error: 'Only active API keys can have their expiry changed.',
        code: 'API_KEY_NOT_ACTIVE',
      });
    }

    const expiryInput = parseApiKeyExpiry(api_key_expires_at);
    if (!expiryInput.ok) {
      return res.status(400).json({ error: expiryInput.message, code: 'INVALID_API_KEY_EXPIRY' });
    }
    const expiresAt = expiryInput.expiresAt;
    const expiryUpdate = await run(db, `
      UPDATE access_requests
      SET api_key_expires_at = $1, api_key_status = 'ACTIVE'
      WHERE id = $2
        AND status = 'APPROVED'
        AND api_key_hash IS NOT NULL
        AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
        AND api_key_revoked_at IS NULL
        AND (api_key_expires_at IS NULL OR api_key_expires_at > $3)
    `, [expiresAt, id, now]);
    if (expiryUpdate.changes !== 1) {
      return res.status(409).json({
        error: 'Only active API keys can have their expiry changed.',
        code: 'API_KEY_NOT_ACTIVE',
      });
    }
    await logAuditEvent(db, 'API_KEY_EXPIRY_UPDATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      consumer_user_id: requestRecord.consumer_user_id,
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
    const requestRecord = await one(db, 'SELECT consumer_mda_id, consumer_user_id, api_id, api_key_hash, api_key_preview, api_key_status, api_key_revoked_at FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }
    if ((requestRecord.api_key_status || 'ACTIVE') !== 'ACTIVE' || requestRecord.api_key_revoked_at) {
      return res.status(409).json({
        error: 'Only active API keys can be revoked.',
        code: 'API_KEY_NOT_ACTIVE',
      });
    }

    const revokedAt = new Date().toISOString();
    const revokeUpdate = await run(db, `
      UPDATE access_requests
      SET api_key_status = 'REVOKED', api_key_revoked_at = $1
      WHERE id = $2
        AND status = 'APPROVED'
        AND api_key_hash IS NOT NULL
        AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
        AND api_key_revoked_at IS NULL
    `, [revokedAt, id]);
    if (revokeUpdate.changes !== 1) {
      return res.status(409).json({
        error: 'Only active API keys can be revoked.',
        code: 'API_KEY_NOT_ACTIVE',
      });
    }
    await logAuditEvent(db, 'API_KEY_REVOKED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      consumer_user_id: requestRecord.consumer_user_id,
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
    const requestRecord = await one(db, 'SELECT consumer_mda_id, consumer_user_id, api_id, api_key_hash, api_key_preview FROM access_requests WHERE id = $1', [id]);
    if (!requestRecord || !requestRecord.api_key_hash) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const deletedAt = new Date().toISOString();
    const deleteUpdate = await run(db, `
      UPDATE access_requests
      SET api_key = NULL,
          api_key_hash = NULL,
          api_key_status = 'DELETED',
          api_key_revoked_at = $1,
          api_key_expires_at = NULL
      WHERE id = $2
        AND api_key_hash IS NOT NULL
    `, [deletedAt, id]);
    if (deleteUpdate.changes !== 1) {
      return res.status(404).json({ error: 'API key not found' });
    }
    await logAuditEvent(db, 'API_KEY_DELETED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      consumer_user_id: requestRecord.consumer_user_id,
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
    const limit = integerQueryParam(req.query.limit, 100);
    const offset = integerQueryParam(req.query.offset, 0);
    const scope = req.query.scope === 'api-calls' ? 'api-calls' : 'all';
    res.json(await listAuditLogs(db, req.user!, limit, offset, { scope }));
  } catch (err: any) {
    console.error('[audit-logs fetch]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs. Please try again.' });
  }
});

// Get Access Matrix
router.get('/matrix', requireAuth(db, ['admin', 'reviewer']), async (req, res) => {
  try {
    // Include both MDA-type and user-type consumers so the full access picture is visible
    const limit = integerQueryParam(req.query.limit, 100);
    const offset = integerQueryParam(req.query.offset, 0);
    const permissions = await buildAccessMatrix(db, limit, offset);
    res.json(permissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch access matrix' });
  }
});
return router;
}
