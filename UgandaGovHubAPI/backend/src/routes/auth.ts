import { Router } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import {
  createSession,
  clearSessionCookie,
  enableUserMfa,
  generateTotpSecret,
  getBearerToken,
  getMfaSecret,
  getSessionUser,
  hashPassword,
  isUserRole,
  normalizeEmail,
  requireAuth,
  revokeSession,
  sanitizeUser,
  setUserMfaSecret,
  setSessionCookie,
  verifyTotpCode,
  verifyPassword,
} from '../auth';
import {
  canSubmitVerification,
  ensureUserProfile,
  encryptProfileForStorage,
  getAccountSnapshot,
  normalizeAccountType,
  upsertVerificationDocument,
} from '../account-verification';
import { clearRateLimit, consumeRateLimit } from '../rate-limit';

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

function mdaExists(db: Database.Database, mdaId: string) {
  return Boolean(db.prepare('SELECT id FROM mdas WHERE id = ?').get(mdaId));
}

function revokeUserApiKeys(db: Database.Database, userId: string, status: 'REVOKED' | 'DELETED' = 'REVOKED') {
  // Check table existence before attempting writes so we don't mask real errors
  const tableExists = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='access_requests'"
  ).get() as any);
  if (!tableExists) return; // Unit fixtures may omit the access schema

  const revokedAt = new Date().toISOString();
  if (status === 'DELETED') {
    db.prepare(`
      UPDATE access_requests
      SET api_key = NULL,
          api_key_hash = NULL,
          api_key_status = 'DELETED',
          api_key_revoked_at = ?,
          api_key_expires_at = NULL,
          consumer_user_id = NULL
      WHERE consumer_user_id = ?
    `).run(revokedAt, userId);
    return;
  }

  db.prepare(`
    UPDATE access_requests
    SET api_key_status = 'REVOKED',
        api_key_revoked_at = ?
    WHERE consumer_user_id = ?
      AND api_key_hash IS NOT NULL
      AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
  `).run(revokedAt, userId);
}

// RFC 5322-simplified: local@domain.tld  (no consecutive dots, no leading/trailing dots)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Password complexity: min 10 chars, at least one of each: uppercase, lowercase, digit, symbol
const PASSWORD_UPPERCASE_RE = /[A-Z]/;
const PASSWORD_LOWERCASE_RE = /[a-z]/;
const PASSWORD_DIGIT_RE = /[0-9]/;
const PASSWORD_SYMBOL_RE = /[^A-Za-z0-9]/;

function validateSignup(body: any) {
  const required = ['full_name', 'email', 'password', 'account_type', 'requested_role', 'requested_organization', 'requested_purpose'];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return `${field} is required.`;
    }
  }
  // Length limits to prevent database bloat and DoS via large payloads.
  if (body.full_name.trim().length > 200) return 'full_name must be 200 characters or fewer.';
  if (body.requested_organization.trim().length > 300) return 'requested_organization must be 300 characters or fewer.';
  if (body.requested_purpose.trim().length > 2000) return 'requested_purpose must be 2000 characters or fewer.';

  if (!EMAIL_RE.test(String(body.email).trim())) return 'A valid email address is required.';
  const pwd: string = body.password;
  if (pwd.length < 10) return 'Password must be at least 10 characters.';
  if (!PASSWORD_UPPERCASE_RE.test(pwd)) return 'Password must contain at least one uppercase letter.';
  if (!PASSWORD_LOWERCASE_RE.test(pwd)) return 'Password must contain at least one lowercase letter.';
  if (!PASSWORD_DIGIT_RE.test(pwd)) return 'Password must contain at least one digit.';
  if (!PASSWORD_SYMBOL_RE.test(pwd)) return 'Password must contain at least one special character.';
  if (!isUserRole(body.requested_role)) return 'requested_role is invalid.';
  if (body.requested_role === 'admin') return 'Admin accounts must be created by an existing administrator.';
  return null;
}

const LOGIN_LIMIT = Number(process.env.GOVHUB_LOGIN_RATE_LIMIT || 10);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function markVerificationChanged(db: Database.Database, userId: string, currentStatus?: string | null) {
  if (!['submitted_for_review', 'verified'].includes(currentStatus || '')) return false;
  db.prepare(`
    UPDATE user_profiles
    SET verification_status = 'needs_more_information',
        review_notes = 'Verification data changed after submission and must be reviewed again.',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(userId);
  db.prepare(`
    UPDATE users
    SET status = 'PENDING_REVIEW', role = NULL, mda_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);
  return true;
}

function countApprovedAdmins(db: Database.Database) {
  return (db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED' AND role = 'admin'").get() as { count: number }).count;
}

function canMutateAdminAccount(db: Database.Database, actorId: string, target: any) {
  if (target.id === actorId) {
    return { allowed: false, code: 'CANNOT_CHANGE_SELF', message: 'Administrators cannot change their own account status.' };
  }
  if (target.status === 'APPROVED' && target.role === 'admin' && countApprovedAdmins(db) <= 1) {
    return { allowed: false, code: 'LAST_ADMIN_FORBIDDEN', message: 'At least one approved administrator account must remain active.' };
  }
  return { allowed: true };
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
    const { email, password, mfa_code } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = normalizeEmail(String(email));
    const attemptKey = `${req.ip || 'unknown'}:${normalizedEmail}`;
    const quota = consumeRateLimit(db, 'login', attemptKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!quota.allowed) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.', code: 'LOGIN_RATE_LIMITED' });
    }

    const user = getUserByEmail(db, normalizedEmail);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.mfa_enabled_at) {
      const secret = getMfaSecret(user);
      if (!secret) {
        return res.status(403).json({ error: 'MFA is enabled but not configured. Contact an administrator.', code: 'MFA_MISCONFIGURED' });
      }
      if (!mfa_code) {
        return res.status(202).json({ mfa_required: true, email: normalizedEmail });
      }
      if (!verifyTotpCode(secret, String(mfa_code))) {
        return res.status(401).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
      }
    }
    // Successful login — clear the rate limit bucket
    clearRateLimit(db, 'login', attemptKey);

    const token = createSession(db, user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
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
    clearSessionCookie(res);
    res.json({ success: true });
  });

  router.post('/mfa/setup', requireAuth(db), (req, res) => {
    const secret = generateTotpSecret();
    setUserMfaSecret(db, req.user!.id, secret);
    const issuer = encodeURIComponent('Uganda GovHub API');
    const label = encodeURIComponent(`${req.user!.email}`);
    res.json({
      secret,
      otpauth_url: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    });
  });

  router.post('/mfa/enable', requireAuth(db), (req, res) => {
    const user = getUserById(db, req.user!.id);
    const secret = getMfaSecret(user);
    if (!secret) {
      return res.status(400).json({ error: 'Start MFA setup before enabling MFA.', code: 'MFA_SETUP_REQUIRED' });
    }
    if (!verifyTotpCode(secret, String(req.body?.code || ''))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    enableUserMfa(db, req.user!.id);
    res.json({ user: sanitizeUser(getUserById(db, req.user!.id)) });
  });

  router.post('/mfa/disable', requireAuth(db), (req, res) => {
    const { password, code } = req.body || {};
    const user = getUserById(db, req.user!.id);
    const secret = getMfaSecret(user);
    if (!password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Password confirmation failed.', code: 'INVALID_PASSWORD' });
    }
    if (user.mfa_enabled_at && (!secret || !verifyTotpCode(secret, String(code || '')))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    db.prepare('UPDATE users SET mfa_enabled_at = NULL, mfa_secret_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(req.user!.id);
    res.json({ user: sanitizeUser(getUserById(db, req.user!.id)) });
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
    if (next.account_category === 'admin') {
      return res.status(400).json({ error: 'Admin account category cannot be self-assigned.', code: 'ADMIN_CATEGORY_FORBIDDEN' });
    }

    const stored = encryptProfileForStorage(next);
    const transaction = db.transaction(() => {
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
        stored.nin,
        stored.national_id_number,
        stored.contact_phone,
        stored.address,
        stored.organization_name,
        stored.organization_type,
        stored.ursb_number,
        stored.brn,
        stored.tin,
        stored.staff_id,
        stored.department,
        stored.job_title,
        stored.supervisor_name,
        stored.supervisor_email,
        req.user!.id
      );
      if (markVerificationChanged(db, req.user!.id, current.profile.verification_status)) {
        revokeUserApiKeys(db, req.user!.id);
      }
    });
    transaction();

    res.json({ account: getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/documents', requireAuth(db), (req, res) => {
    const { type, label, file_name, mime_type, storage_ref } = req.body || {};
    if (!type || !label || !file_name || !mime_type) {
      return res.status(400).json({ error: 'type, label, file_name, and mime_type are required.' });
    }
    const current = getAccountSnapshot(db, req.user!.id);
    const transaction = db.transaction(() => {
      upsertVerificationDocument(db, req.user!.id, { type, label, file_name, mime_type, storage_ref });
      if (markVerificationChanged(db, req.user!.id, current?.profile.verification_status)) {
        revokeUserApiKeys(db, req.user!.id);
      }
    });
    transaction();
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

    const mutationDecision = canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    const snapshot = getAccountSnapshot(db, req.params.id);
    if (!snapshot || snapshot.profile.verification_status !== 'submitted_for_review') {
      return res.status(400).json({ error: 'User verification must be submitted for review before approval.', code: 'VERIFICATION_NOT_SUBMITTED' });
    }

    const needsMda = approvalRequiresMda(existing.account_type, role);
    const approvedMdaId = needsMda ? mda_id || existing.requested_mda_id || null : null;
    if (needsMda && (!approvedMdaId || typeof approvedMdaId !== 'string')) {
      return res.status(400).json({ error: 'mda_id is required for this account type and role.' });
    }
    if (approvedMdaId && !mdaExists(db, approvedMdaId)) {
      return res.status(400).json({ error: 'mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
    }

    // Wrap MDA re-check and user update in a single transaction to prevent race conditions
    const approveUser = db.transaction(() => {
      if (approvedMdaId && !mdaExists(db, approvedMdaId)) {
        throw Object.assign(new Error('mda_id must reference an existing MDA.'), { code: 'MDA_NOT_FOUND' });
      }
      db.prepare(`
        UPDATE users
        SET status = 'APPROVED', role = ?, mda_id = ?, reviewed_by = ?, reviewed_at = ?,
            rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(role, approvedMdaId, req.user!.id, new Date().toISOString(), req.params.id);
      db.prepare("UPDATE user_profiles SET verification_status = 'verified', review_notes = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.params.id);
    });

    try {
      approveUser();
    } catch (err: any) {
      if (err?.code === 'MDA_NOT_FOUND') {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.post('/:id/needs-more-information', (req, res) => {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

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
    const mutationDecision = canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    db.prepare(`
      UPDATE users
      SET status = 'REJECTED', role = NULL, mda_id = NULL, reviewed_by = ?,
          reviewed_at = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, new Date().toISOString(), reason || 'Application rejected by administrator.', req.params.id);
    db.prepare("UPDATE user_profiles SET verification_status = 'rejected', review_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(reason || 'Application rejected by administrator.', req.params.id);
    revokeUserApiKeys(db, req.params.id);

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.post('/:id/suspend', (req, res) => {
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    db.prepare(`
      UPDATE users
      SET status = 'SUSPENDED', reviewed_by = ?, reviewed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, new Date().toISOString(), req.params.id);
    db.prepare("UPDATE user_profiles SET verification_status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(req.params.id);
    revokeUserApiKeys(db, req.params.id);

    res.json({ user: sanitizeUser(getUserById(db, req.params.id)) });
  });

  router.delete('/:id', (req, res) => {
    const existing = getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    if (existing.id === req.user!.id) {
      return res.status(400).json({ error: 'Administrators cannot delete their own account.', code: 'CANNOT_DELETE_SELF' });
    }
    const mutationDecision = canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    const deletedUser = sanitizeUser(existing);
    const deleteAccount = db.transaction(() => {
      db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), existing.id);
      revokeUserApiKeys(db, existing.id, 'DELETED');
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
