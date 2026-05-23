import type Database from 'better-sqlite3';
import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from './auth';

type AccessUser = {
  id: string;
  role: UserRole | null;
  mda_id: string | null;
};

type GuardDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

export function resolveConsumerMdaForRequest(user: AccessUser, requestedMdaId?: string | null): GuardDecision & { mdaId?: string; userId?: string; consumerType?: 'mda' | 'user' } {
  if (user.role === 'admin') {
    if (!requestedMdaId) {
      return { allowed: false, code: 'MDA_REQUIRED', message: 'consumer_mda_id is required.' };
    }
    return { allowed: true, mdaId: requestedMdaId, consumerType: 'mda' };
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
  return { allowed: true, mdaId: user.mda_id, consumerType: 'mda' };
}

export function buildAccessRequestList(db: Database.Database, user: AccessUser) {
  const baseSelect = `
    SELECT
      r.*,
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
    return db.prepare(`${baseSelect} ORDER BY r.created_at DESC`).all();
  }
  if (user.role === 'api_owner') {
    return db.prepare(`${baseSelect} WHERE a.owning_mda_id = ? ORDER BY r.created_at DESC`).all(user.mda_id);
  }
  if (user.mda_id) {
    return db.prepare(`${baseSelect} WHERE r.consumer_mda_id = ? ORDER BY r.created_at DESC`).all(user.mda_id);
  }
  return db.prepare(`${baseSelect} WHERE r.consumer_user_id = ? ORDER BY r.created_at DESC`).all(user.id);
}

export function canSubmitAccessRequest(db: Database.Database, apiId: string): GuardDecision {
  const api = db.prepare('SELECT id FROM apis WHERE id = ?').get(apiId);
  if (!api) {
    return { allowed: false, code: 'API_NOT_FOUND', message: 'The requested API does not exist.' };
  }
  return { allowed: true };
}

export function listAuditLogs(db: Database.Database, user?: AccessUser) {
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

  if (user?.role === 'developer') {
    if (user.mda_id) {
      return db.prepare(`${baseSelect} WHERE l.mda_id = ? ORDER BY l.created_at DESC`).all(user.mda_id) as any[];
    }
    return db.prepare(`${baseSelect} WHERE l.consumer_user_id = ? ORDER BY l.created_at DESC`).all(user.id) as any[];
  }

  return db.prepare(`${baseSelect} ORDER BY l.created_at DESC`).all() as any[];
}

export function canReviewAccessRequest(db: Database.Database, user: AccessUser, requestId: string): GuardDecision {
  const statusCheck = db.prepare('SELECT status, api_key, api_key_status FROM access_requests WHERE id = ?').get(requestId) as any;
  if (statusCheck && (statusCheck.status !== 'PENDING' || statusCheck.api_key || ['REVOKED', 'DELETED'].includes(statusCheck.api_key_status || ''))) {
    return {
      allowed: false,
      code: 'REQUEST_ALREADY_FINALIZED',
      message: 'This access request already has a finalized API key lifecycle.',
    };
  }

  if (user.role === 'admin') return { allowed: true };
  if (user.role !== 'api_owner' || !user.mda_id) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only admins and owning MDA API owners can approve this request.' };
  }

  const request = db.prepare(`
    SELECT r.id, r.status, r.api_key, r.api_key_status
    FROM access_requests r
    JOIN apis a ON a.id = r.api_id
    WHERE r.id = ? AND a.owning_mda_id = ?
  `).get(requestId, user.mda_id) as any;

  if (!request) {
    return { allowed: false, code: 'FORBIDDEN', message: 'API owners can only approve requests for APIs owned by their MDA.' };
  }
  return { allowed: true };
}

export function canManageApi(db: Database.Database, user: AccessUser, apiId: string): GuardDecision {
  if (user.role === 'admin') return { allowed: true };
  if (user.role !== 'api_owner' || !user.mda_id) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only admins and owning MDA API owners can manage this API.' };
  }

  const api = db.prepare('SELECT id FROM apis WHERE id = ? AND owning_mda_id = ?').get(apiId, user.mda_id);
  if (!api) {
    return { allowed: false, code: 'FORBIDDEN', message: 'API owners can only manage APIs owned by their MDA.' };
  }
  return { allowed: true };
}

export function requireApiManager(db: Database.Database, getApiId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const decision = canManageApi(db, req.user!, getApiId(req));
    if (!decision.allowed) {
      return res.status(403).json({ error: decision.message, code: decision.code });
    }
    next();
  };
}
