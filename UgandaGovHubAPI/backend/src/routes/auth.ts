import { Router } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import {
  createSession,
  getBearerToken,
  getSessionUser,
  hashPassword,
  isUserRole,
  normalizeEmail,
  requireAuth,
  revokeSession,
  sanitizeUser,
  verifyPassword,
} from '../auth';
import {
  canSubmitVerification,
  ensureUserProfile,
  getAccountSnapshot,
  normalizeAccountType,
  upsertVerificationDocument,
} from '../account-verification';

function getUserByEmail(db: Database.Database, email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as any;
}

function getUserById(db: Database.Database, id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
}

function approvalRequiresMda(accountType: string | null | undefined, role: string) {
  const normalizedAccountType = normalizeAccountType(accountType || '');
  return role === 'api_owner' || normalizedAccountType === 'government_employee' || normalizedAccountType === 'mda_api_owner';
}

function validateSignup(body: any) {
  const required = ['full_name', 'email', 'password', 'account_type', 'requested_role', 'requested_organization', 'requested_purpose'];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return `${field} is required.`;
    }
  }
  if (!body.email.includes('@')) return 'A valid email is required.';
  if (body.password.length < 10) return 'Password must be at least 10 characters.';
  if (!isUserRole(body.requested_role)) return 'requested_role is invalid.';
  return null;
}

export function authRouter(db: Database.Database) {
  const router = Router();

  router.post('/signup', (req, res) => {
    const error = validateSignup(req.body || {});
    if (error) return res.status(400).json({ error });

    const email = normalizeEmail(req.body.email);
    if (getUserByEmail(db, email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = `usr_${crypto.randomUUID()}`;
    db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')
    `).run(
      id,
      req.body.full_name.trim(),
      email,
      hashPassword(req.body.password),
      req.body.account_type.trim(),
      req.body.requested_role,
      req.body.requested_mda_id || null,
      req.body.requested_organization.trim(),
      req.body.requested_purpose.trim()
    );
    ensureUserProfile(db, id, req.body.account_type, req.body.requested_organization.trim());

    res.status(201).json({ user: sanitizeUser(getUserById(db, id)) });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = getUserByEmail(db, email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = createSession(db, user.id);
    res.json({ token, user: sanitizeUser(user) });
  });

  router.get('/me', (req, res) => {
    const token = getBearerToken(req);
    const user = token ? getSessionUser(db, token) : null;
    if (!user) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }

    res.json({ user: sanitizeUser(user) });
  });

  router.post('/logout', (req, res) => {
    const token = getBearerToken(req);
    if (token) revokeSession(db, token);
    res.json({ success: true });
  });

  router.get('/account', requireAuth(db), (req, res) => {
    const snapshot = getAccountSnapshot(db, req.user!.id);
    res.json({ account: snapshot });
  });

  router.patch('/account/profile', requireAuth(db), (req, res) => {
    const allowed = [
      'account_category',
      'nin',
      'national_id_number',
      'contact_phone',
      'address',
      'organization_name',
      'organization_type',
      'ursb_number',
      'brn',
      'tin',
      'staff_id',
      'department',
      'job_title',
      'supervisor_name',
      'supervisor_email',
    ];
    const current = getAccountSnapshot(db, req.user!.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });

    const next: Record<string, any> = {};
    for (const key of allowed) {
      next[key] = Object.prototype.hasOwnProperty.call(req.body, key) ? req.body[key] || null : (current.profile as any)[key];
    }
    next.account_category = normalizeAccountType(next.account_category);

    db.prepare(`
      UPDATE user_profiles SET
        account_category = ?, nin = ?, national_id_number = ?, contact_phone = ?, address = ?,
        organization_name = ?, organization_type = ?, ursb_number = ?, brn = ?, tin = ?,
        staff_id = ?, department = ?, job_title = ?, supervisor_name = ?, supervisor_email = ?,
        verification_status = CASE
          WHEN verification_status IN ('submitted_for_review', 'verified') THEN verification_status
          ELSE 'draft_profile'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(
      next.account_category,
      next.nin,
      next.national_id_number,
      next.contact_phone,
      next.address,
      next.organization_name,
      next.organization_type,
      next.ursb_number,
      next.brn,
      next.tin,
      next.staff_id,
      next.department,
      next.job_title,
      next.supervisor_name,
      next.supervisor_email,
      req.user!.id
    );

    res.json({ account: getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/documents', requireAuth(db), (req, res) => {
    const { type, label, file_name, mime_type, storage_ref } = req.body || {};
    if (!type || !label || !file_name || !mime_type) {
      return res.status(400).json({ error: 'type, label, file_name, and mime_type are required.' });
    }
    upsertVerificationDocument(db, req.user!.id, { type, label, file_name, mime_type, storage_ref });
    res.status(201).json({ account: getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/submit-verification', requireAuth(db), (req, res) => {
    const snapshot = getAccountSnapshot(db, req.user!.id);
    if (!snapshot) return res.status(404).json({ error: 'Account not found.' });
    const decision = canSubmitVerification(snapshot);
    if (!decision.allowed) {
      return res.status(400).json({ error: decision.message });
    }
    db.prepare(`
      UPDATE user_profiles
      SET verification_status = 'submitted_for_review', submitted_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(new Date().toISOString(), req.user!.id);
    res.json({ account: getAccountSnapshot(db, req.user!.id) });
  });

  return router;
}

export function adminUsersRouter(db: Database.Database) {
  const router = Router();

  router.use(requireAuth(db, ['admin']));

  router.get('/', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const users = status
      ? db.prepare('SELECT * FROM users WHERE status = ? ORDER BY created_at DESC').all(status)
      : db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    res.json({
      users: users.map(user => ({
        ...sanitizeUser(user as any),
        account: getAccountSnapshot(db, (user as any).id),
      })),
    });
  });

  router.post('/:id/approve', (req, res) => {
    const { role, mda_id } = req.body || {};
    if (!isUserRole(role)) {
      return res.status(400).json({ error: 'A valid role is required.' });
    }

    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const needsMda = approvalRequiresMda(existing.account_type, role);
    const approvedMdaId = needsMda ? mda_id || existing.requested_mda_id || null : null;
    if (needsMda && (!approvedMdaId || typeof approvedMdaId !== 'string')) {
      return res.status(400).json({ error: 'mda_id is required for this account type and role.' });
    }

    db.prepare(`
      UPDATE users
      SET status = 'APPROVED', role = ?, mda_id = ?, reviewed_by = ?, reviewed_at = ?,
          rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(role, approvedMdaId, req.user!.id, new Date().toISOString(), req.params.id);
    db.prepare("UPDATE user_profiles SET verification_status = 'verified', review_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.params.id);

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.post('/:id/needs-more-information', (req, res) => {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    db.prepare(`
      UPDATE user_profiles
      SET verification_status = 'needs_more_information', review_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(notes || 'Additional verification information is required.', req.params.id);

    res.json({ account: getAccountSnapshot(db, req.params.id) });
  });

  router.post('/:id/reject', (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    db.prepare(`
      UPDATE users
      SET status = 'REJECTED', role = NULL, mda_id = NULL, reviewed_by = ?,
          reviewed_at = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, new Date().toISOString(), reason || 'Application rejected by administrator.', req.params.id);
    db.prepare("UPDATE user_profiles SET verification_status = 'rejected', review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(reason || 'Application rejected by administrator.', req.params.id);

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.post('/:id/suspend', (req, res) => {
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    db.prepare(`
      UPDATE users
      SET status = 'SUSPENDED', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, new Date().toISOString(), req.params.id);
    db.prepare("UPDATE user_profiles SET verification_status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.params.id);

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.delete('/:id', (req, res) => {
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    if (existing.id === req.user!.id) {
      return res.status(400).json({ error: 'Administrators cannot delete their own account.', code: 'CANNOT_DELETE_SELF' });
    }

    const deletedUser = sanitizeUser(existing);
    const deleteAccount = db.transaction(() => {
      db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), existing.id);
      db.prepare('DELETE FROM verification_documents WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    });

    deleteAccount();
    res.json({ deleted: true, user: deletedUser });
  });

  return router;
}
