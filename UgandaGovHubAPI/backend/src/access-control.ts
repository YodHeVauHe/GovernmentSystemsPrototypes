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

export function resolveConsumerMdaForRequest(user: AccessUser, requestedMdaId?: string | null): GuardDecision & { mdaId?: string } {
  if (user.role === 'admin') {
    if (!requestedMdaId) {
      return { allowed: false, code: 'MDA_REQUIRED', message: 'consumer_mda_id is required.' };
    }
    return { allowed: true, mdaId: requestedMdaId };
  }

  if (!user.mda_id) {
    return { allowed: false, code: 'MDA_NOT_ASSIGNED', message: 'Your account does not have an approved MDA assignment.' };
  }
  if (requestedMdaId && requestedMdaId !== user.mda_id) {
    return {
      allowed: false,
      code: 'MDA_IMPERSONATION',
      message: 'Access requests must use the approved MDA assigned to your account.',
    };
  }
  return { allowed: true, mdaId: user.mda_id };
}

export function buildAccessRequestList(db: Database.Database, user: AccessUser) {
  const baseSelect = `
    SELECT r.*, a.name as api_name, a.owning_mda_id, m.name as mda_name
    FROM access_requests r
    JOIN apis a ON r.api_id = a.id
    JOIN mdas m ON r.consumer_mda_id = m.id
  `;

  if (user.role === 'admin' || user.role === 'reviewer') {
    return db.prepare(`${baseSelect} ORDER BY r.created_at DESC`).all();
  }
  if (user.role === 'api_owner') {
    return db.prepare(`${baseSelect} WHERE a.owning_mda_id = ? ORDER BY r.created_at DESC`).all(user.mda_id);
  }
  return db.prepare(`${baseSelect} WHERE r.consumer_mda_id = ? ORDER BY r.created_at DESC`).all(user.mda_id);
}

export function listAuditLogs(db: Database.Database) {
  return db.prepare(`
    SELECT l.*, a.name as api_name, COALESCE(m.name, l.mda_id) as mda_name
    FROM audit_logs l
    LEFT JOIN apis a ON l.api_id = a.id
    LEFT JOIN mdas m ON l.mda_id = m.id
    ORDER BY l.created_at DESC
  `).all() as any[];
}

export function canReviewAccessRequest(db: Database.Database, user: AccessUser, requestId: string): GuardDecision {
  if (user.role === 'admin') return { allowed: true };
  if (user.role !== 'api_owner' || !user.mda_id) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Only admins and owning MDA API owners can approve this request.' };
  }

  const request = db.prepare(`
    SELECT r.id
    FROM access_requests r
    JOIN apis a ON a.id = r.api_id
    WHERE r.id = ? AND a.owning_mda_id = ?
  `).get(requestId, user.mda_id);

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
