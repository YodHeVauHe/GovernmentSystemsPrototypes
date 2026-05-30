import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from './auth';
import type { DbClient } from './db';
import { many, one } from './db';

type AccessUser = {
  id: string;
  role: UserRole | null;
  mda_id: string | null;
};

type AccessRequestListRow = {
  consumer_mda_id?: string | null;
  consumer_user_id?: string | null;
  api_key_preview?: string | null;
  api_key_pending_reveal?: boolean | number | null;
  [key: string]: any;
};

type GuardDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

function canViewOneTimeApiKeyState(user: AccessUser, request: AccessRequestListRow) {
  if (user.role !== 'developer') return true;
  if (request.consumer_user_id) return request.consumer_user_id === user.id;
  return Boolean(user.mda_id && request.consumer_mda_id === user.mda_id);
}

function maskHiddenOneTimeApiKeyState(user: AccessUser, requests: AccessRequestListRow[]) {
  return requests.map(request => {
    if (canViewOneTimeApiKeyState(user, request)) return request;
    return {
      ...request,
      api_key_preview: null,
      api_key_pending_reveal: false,
    };
  });
}

export function resolveConsumerMdaForRequest(user: AccessUser, requestedMdaId?: string | null): GuardDecision & { mdaId?: string; userId?: string; consumerType?: 'mda' | 'user' } {
  if (user.role === 'admin') {
    if (!requestedMdaId) {
      return { allowed: false, code: 'MDA_REQUIRED', message: 'consumer_mda_id is required.' };
    }
    return { allowed: true, mdaId: requestedMdaId, userId: user.id, consumerType: 'mda' };
  }

  if (!user.mda_id) {
    if (requestedMdaId) {
      return {
        allowed: false,
        code: 'MDA_IMPERSONATION',
        message: 'Access requests must use the approved MDA assigned to your account.',
      };
    }
    return { allowed: true, userId: user.id, consumerType: 'user' };
  }
  if (requestedMdaId && requestedMdaId !== user.mda_id) {
    return {
      allowed: false,
      code: 'MDA_IMPERSONATION',
      message: 'Access requests must use the approved MDA assigned to your account.',
    };
  }
  return { allowed: true, mdaId: user.mda_id, userId: user.id, consumerType: 'mda' };
}

export async function buildAccessRequestList(db: DbClient, user: AccessUser) {
  const baseSelect = `
    SELECT
      r.id, r.consumer_mda_id, r.consumer_user_id, r.consumer_type, r.api_id, r.purpose,
      r.status, r.api_key_preview, r.api_key_status, r.api_key_expires_at, r.api_key_revoked_at,
      (r.api_key IS NOT NULL) as api_key_pending_reveal,
      r.requested_fields, r.volume_tier, r.legal_basis, r.environment, r.created_at,
      a.name as api_name,
      a.owning_mda_id,
      COALESCE(m.name, consumer.requested_organization, consumer.full_name, r.consumer_user_id) as mda_name,
      COALESCE(m.short_name, consumer.requested_organization, consumer.full_name, r.consumer_user_id) as consumer_name
    FROM access_requests r
    JOIN apis a ON r.api_id = a.id
    LEFT JOIN mdas m ON r.consumer_mda_id = m.id
    LEFT JOIN users consumer ON r.consumer_user_id = consumer.id
  `;

  if (user.role === 'admin' || user.role === 'reviewer') {
    return many(db, `${baseSelect} ORDER BY r.created_at DESC`);
  }
  if (user.role === 'api_owner') {
    return many(db, `${baseSelect} WHERE a.owning_mda_id = $1 ORDER BY r.created_at DESC`, [user.mda_id]);
  }
  if (user.mda_id) {
    const requests = await many(db, `${baseSelect} WHERE r.consumer_mda_id = $1 ORDER BY r.created_at DESC`, [user.mda_id]);
    return maskHiddenOneTimeApiKeyState(user, requests);
  }
  const requests = await many(db, `${baseSelect} WHERE r.consumer_user_id = $1 ORDER BY r.created_at DESC`, [user.id]);
  return maskHiddenOneTimeApiKeyState(user, requests);
}

export async function canSubmitAccessRequest(db: DbClient, apiId: string): Promise<GuardDecision> {
  const api = await one(db, 'SELECT id FROM apis WHERE id = $1', [apiId]);
  if (!api) {
    return { allowed: false, code: 'API_NOT_FOUND', message: 'The requested API does not exist.' };
  }
  return { allowed: true };
}

export type BlockingAccessRequest = {
  id: string;
  status: string;
  api_key_status: string | null;
};

export async function findBlockingAccessRequest(
  db: DbClient,
  input: {
    apiId: string;
    consumerMdaId?: string | null;
    consumerUserId?: string | null;
  }
): Promise<BlockingAccessRequest | undefined> {
  const identityValue = input.consumerMdaId || input.consumerUserId;
  if (!identityValue) return undefined;

  const identityColumn = input.consumerMdaId ? 'consumer_mda_id' : 'consumer_user_id';
  return one<BlockingAccessRequest>(db, `
    SELECT id, status, api_key_status
    FROM access_requests
    WHERE api_id = $1
      AND ${identityColumn} = $2
      AND (
        status = 'PENDING'
        OR (
          status = 'APPROVED'
          AND api_key_hash IS NOT NULL
          AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
          AND api_key_revoked_at IS NULL
          AND (api_key_expires_at IS NULL OR api_key_expires_at > $3)
        )
      )
    ORDER BY created_at DESC
    LIMIT 1
  `, [input.apiId, identityValue, new Date().toISOString()]);
}

export interface AuditLogPage {
  data: any[];
  total: number;
  limit: number;
  offset: number;
}

function boundedPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer < 1) return fallback;
  return Math.min(integer, max);
}

function nonNegativeInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

type AuditLogScope = 'all' | 'api-calls';

type ListAuditLogOptions = {
  scope?: AuditLogScope;
};

function apiCallLogWhereClause(user: AccessUser) {
  const hasMdaScope = Boolean(user.mda_id);
  return {
    whereClause: hasMdaScope
      ? "WHERE (l.consumer_user_id = $1 OR (l.consumer_user_id IS NULL AND l.mda_id = $2)) AND l.event_type LIKE 'SANDBOX_CALL%'"
      : "WHERE l.consumer_user_id = $1 AND l.event_type LIKE 'SANDBOX_CALL%'",
    params: hasMdaScope ? [user.id, user.mda_id] : [user.id],
  };
}

export async function listAuditLogs(
  db: DbClient,
  user?: AccessUser,
  limit = 100,
  offset = 0,
  options: ListAuditLogOptions = {}
): Promise<AuditLogPage> {
  const baseSelect = `
    SELECT
      l.*,
      a.name as api_name,
      COALESCE(m.name, consumer.requested_organization, consumer.full_name, l.mda_id, l.consumer_user_id) as mda_name
    FROM audit_logs l
    LEFT JOIN apis a ON l.api_id = a.id
    LEFT JOIN mdas m ON l.mda_id = m.id
    LEFT JOIN users consumer ON l.consumer_user_id = consumer.id
  `;

  const safeLimit = boundedPositiveInteger(limit, 100, 500);
  const safeOffset = nonNegativeInteger(offset, 0);

  if (user && (user.role === 'developer' || options.scope === 'api-calls')) {
    const { whereClause, params } = apiCallLogWhereClause(user);

    const total = Number((await one<{ count: string }>(db, `SELECT COUNT(*) as count FROM audit_logs l ${whereClause}`, params))?.count || 0);
    const data = await many(
      db,
      `${baseSelect} ${whereClause} ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safeLimit, safeOffset]
    );
    return { data, total, limit: safeLimit, offset: safeOffset };
  }

  const total = Number((await one<{ count: string }>(db, 'SELECT COUNT(*) as count FROM audit_logs'))?.count || 0);
  const data = await many(db, `${baseSelect} ORDER BY l.created_at DESC LIMIT $1 OFFSET $2`, [safeLimit, safeOffset]);
  return { data, total, limit: safeLimit, offset: safeOffset };
}

export async function canReviewAccessRequest(db: DbClient, user: AccessUser, requestId: string): Promise<GuardDecision> {
  // Single query: fetch the request and ownership info atomically to avoid
  // a TOCTOU window between the status check and the ownership check.
  const record = await one(db, `
    SELECT r.id, r.status, r.api_key, r.api_key_hash, r.api_key_status, a.owning_mda_id
    FROM access_requests r
    JOIN apis a ON a.id = r.api_id
    WHERE r.id = $1
  `, [requestId]);

  if (!record) {
    return { allowed: false, code: 'NOT_FOUND', message: 'Access request not found.' };
  }

  if (user.role === 'admin') {
    if (
      record.status !== 'PENDING' ||
      record.api_key ||
      record.api_key_hash ||
      ['REVOKED', 'DELETED'].includes(record.api_key_status || '')
    ) {
      return {
        allowed: false,
        code: 'REQUEST_ALREADY_FINALIZED',
        message: 'This access request already has a finalized API key lifecycle.',
      };
    }
    return { allowed: true };
  }

  if (user.role !== 'api_owner' || !user.mda_id) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only admins and owning MDA API owners can approve this request.' };
  }

  if (record.owning_mda_id !== user.mda_id) {
    return { allowed: false, code: 'NOT_FOUND', message: 'Access request not found.' };
  }

  if (
    record.status !== 'PENDING' ||
    record.api_key ||
    record.api_key_hash ||
    ['REVOKED', 'DELETED'].includes(record.api_key_status || '')
  ) {
    return {
      allowed: false,
      code: 'REQUEST_ALREADY_FINALIZED',
      message: 'This access request already has a finalized API key lifecycle.',
    };
  }

  return { allowed: true };
}

export async function canManageApi(db: DbClient, user: AccessUser, apiId: string): Promise<GuardDecision> {
  if (user.role === 'admin') return { allowed: true };
  if (user.role !== 'api_owner' || !user.mda_id) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only admins and owning MDA API owners can manage this API.' };
  }

  const api = await one(db, 'SELECT id FROM apis WHERE id = $1 AND owning_mda_id = $2', [apiId, user.mda_id]);
  if (!api) {
    return { allowed: false, code: 'FORBIDDEN', message: 'API owners can only manage APIs owned by their MDA.' };
  }
  return { allowed: true };
}

export function canTransferApiOwnership(user: AccessUser): GuardDecision {
  if (user.role === 'admin') return { allowed: true };
  return {
    allowed: false,
    code: 'OWNER_TRANSFER_FORBIDDEN',
    message: 'Only platform administrators can transfer API ownership.',
  };
}

export function requireApiManager(db: DbClient, getApiId: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication is required.', code: 'UNAUTHENTICATED' });
    }
    const decision = await canManageApi(db, req.user, getApiId(req));
    if (decision.allowed === false) {
      return res.status(403).json({ error: decision.message, code: decision.code });
    }
    next();
  };
}
