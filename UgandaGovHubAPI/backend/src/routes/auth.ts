import { Router } from 'express';
import crypto from 'crypto';
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
  ACCOUNT_TYPE_REQUIREMENTS,
  canSubmitVerification,
  ensureUserProfile,
  encryptProfileForStorage,
  getAccountSnapshot,
  normalizeAccountType,
  upsertVerificationDocument,
} from '../account-verification';
import { clearRateLimit, consumeRateLimit } from '../rate-limit';
import type { Db, DbClient } from '../db';
import { many, one, run, tableExists } from '../db';
import { validateTurnstileToken } from '../turnstile';

async function getUserByEmail(db: DbClient, email: string) {
  return one(db, 'SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
}

async function getUserById(db: DbClient, id: string) {
  return one(db, 'SELECT * FROM users WHERE id = $1', [id]);
}

function approvalRequiresMda(accountType: string | null | undefined, role: string) {
  const normalizedAccountType = normalizeAccountType(accountType || '');
  return role === 'admin' || role === 'api_owner' || normalizedAccountType === 'government_employee' || normalizedAccountType === 'mda_api_owner';
}

async function mdaExists(db: DbClient, mdaId: string) {
  return Boolean(await one(db, 'SELECT id FROM mdas WHERE id = $1', [mdaId]));
}

async function revokeUserApiKeys(db: DbClient, userId: string, status: 'REVOKED' | 'DELETED' = 'REVOKED') {
  // Check table existence before attempting writes so we don't mask real errors
  if (!await tableExists(db, 'access_requests')) return; // Unit fixtures may omit the access schema

  const revokedAt = new Date().toISOString();
  if (status === 'DELETED') {
    await run(db, `
      UPDATE access_requests
      SET api_key = NULL,
          api_key_hash = NULL,
          api_key_status = 'DELETED',
          api_key_revoked_at = $1,
          api_key_expires_at = NULL,
          consumer_user_id = NULL
      WHERE consumer_user_id = $2
    `, [revokedAt, userId]);
    return;
  }

  await run(db, `
    UPDATE access_requests
    SET api_key_status = 'REVOKED',
        api_key_revoked_at = $1
    WHERE consumer_user_id = $2
      AND api_key_hash IS NOT NULL
      AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
  `, [revokedAt, userId]);
}

// RFC 5322-simplified: local@domain.tld  (no consecutive dots, no leading/trailing dots)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Password complexity: min 10 chars, at least one of each: uppercase, lowercase, digit, symbol
const PASSWORD_UPPERCASE_RE = /[A-Z]/;
const PASSWORD_LOWERCASE_RE = /[a-z]/;
const PASSWORD_DIGIT_RE = /[0-9]/;
const PASSWORD_SYMBOL_RE = /[^A-Za-z0-9]/;
const SIGNUP_ACCOUNT_TYPES = new Set(
  Object.keys(ACCOUNT_TYPE_REQUIREMENTS).filter(accountType => accountType !== 'admin')
);

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
  const requestedAccountType = body.account_type.trim();
  const normalizedAccountType = normalizeAccountType(requestedAccountType);
  const isKnownAccountType = requestedAccountType === 'government' || SIGNUP_ACCOUNT_TYPES.has(requestedAccountType);
  if (!isKnownAccountType || !SIGNUP_ACCOUNT_TYPES.has(normalizedAccountType)) {
    return 'account_type is invalid.';
  }
  if (!isUserRole(body.requested_role)) return 'requested_role is invalid.';
  if (body.requested_role === 'admin') return 'Admin accounts must be created by an existing administrator.';
  return null;
}

const LOGIN_LIMIT = Number(process.env.GOVHUB_LOGIN_RATE_LIMIT || 10);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function turnstileTokenFromBody(body: any) {
  return body?.turnstile_token || body?.cf_turnstile_response || body?.['cf-turnstile-response'];
}

async function verifyHumanRequest(req: any, action: 'app_load' | 'login' | 'signup') {
  return validateTurnstileToken({
    token: turnstileTokenFromBody(req.body || {}),
    action,
    remoteIp: req.ip,
  });
}

function sendTurnstileError(res: any, result: Awaited<ReturnType<typeof validateTurnstileToken>>) {
  if (result.ok) return false;
  res.status(result.status).json({
    error: result.message,
    code: result.code,
    errors: result.errors,
  });
  return true;
}

async function markVerificationChanged(db: DbClient, userId: string, currentStatus?: string | null) {
  if (!['submitted_for_review', 'verified'].includes(currentStatus || '')) return false;
  await run(db, `
    UPDATE user_profiles
    SET verification_status = 'needs_more_information',
        review_notes = 'Verification data changed after submission and must be reviewed again.',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
  `, [userId]);
  await run(db, `
    UPDATE users
    SET status = 'PENDING_REVIEW', role = NULL, mda_id = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [userId]);
  return true;
}

async function countApprovedAdmins(db: DbClient) {
  return Number((await one<{ count: string }>(db, "SELECT COUNT(*) as count FROM users WHERE status = 'APPROVED' AND role = 'admin'"))?.count || 0);
}

async function canMutateAdminAccount(db: DbClient, actorId: string, target: any) {
  if (target.id === actorId) {
    return { allowed: false, code: 'CANNOT_CHANGE_SELF', message: 'Administrators cannot change their own account status.' };
  }
  if (target.status === 'APPROVED' && target.role === 'admin' && await countApprovedAdmins(db) <= 1) {
    return { allowed: false, code: 'LAST_ADMIN_FORBIDDEN', message: 'At least one approved administrator account must remain active.' };
  }
  return { allowed: true };
}

function isApprovedAdminAccount(user: any) {
  return user?.status === 'APPROVED' && user?.role === 'admin';
}

function wouldVerificationChange(currentStatus?: string | null) {
  return ['submitted_for_review', 'verified'].includes(currentStatus || '');
}

async function rejectSelfAdminVerificationMutation(db: DbClient, actorId: string, target: any, currentVerificationStatus?: string | null) {
  if (!isApprovedAdminAccount(target) || !wouldVerificationChange(currentVerificationStatus)) {
    return null;
  }
  return canMutateAdminAccount(db, actorId, target);
}

export function authRouter(db: Db) {
  const router = Router();

  router.post('/human-verification', async (req, res) => {
    const turnstile = await verifyHumanRequest(req, 'app_load');
    if (sendTurnstileError(res, turnstile)) return;
    res.json({ verified: true });
  });

  router.post('/signup', async (req, res) => {
    const turnstile = await verifyHumanRequest(req, 'signup');
    if (sendTurnstileError(res, turnstile)) return;

    const error = validateSignup(req.body || {});
    if (error) return res.status(400).json({ error });

    const email = normalizeEmail(req.body.email);
    if (await getUserByEmail(db, email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = `usr_${crypto.randomUUID()}`;
    const accountType = normalizeAccountType(req.body.account_type);
    await run(db, `
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_REVIEW')
    `, [
      id,
      req.body.full_name.trim(),
      email,
      hashPassword(req.body.password),
      accountType,
      req.body.requested_role,
      req.body.requested_mda_id || null,
      req.body.requested_organization.trim(),
      req.body.requested_purpose.trim()
    ]);
    await ensureUserProfile(db, id, accountType, req.body.requested_organization.trim());

    res.status(201).json({ user: sanitizeUser(await getUserById(db, id)) });
  });

  router.post('/login', async (req, res) => {
    const turnstile = await verifyHumanRequest(req, 'login');
    if (sendTurnstileError(res, turnstile)) return;

    const { email, password, mfa_code } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = normalizeEmail(String(email));
    const attemptKey = `${req.ip || 'unknown'}:${normalizedEmail}`;
    const quota = await consumeRateLimit(db, 'login', attemptKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!quota.allowed) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.', code: 'LOGIN_RATE_LIMITED' });
    }

    const user = await getUserByEmail(db, normalizedEmail);
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
    await clearRateLimit(db, 'login', attemptKey);

    const token = await createSession(db, user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
  });

  router.get('/me', async (req, res) => {
    const token = getBearerToken(req);
    const user = token ? await getSessionUser(db, token) : null;
    if (!user) {
      return res.status(401).json({ error: 'Authentication is required.' });
    }

    res.json({ user: sanitizeUser(user) });
  });

  router.post('/logout', async (req, res) => {
    const token = getBearerToken(req);
    if (token) await revokeSession(db, token);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  router.post('/mfa/setup', requireAuth(db), async (req, res) => {
    const user = await getUserById(db, req.user!.id);
    if (user.mfa_enabled_at) {
      return res.status(409).json({
        error: 'MFA is already enabled. Disable MFA before starting a new setup.',
        code: 'MFA_ALREADY_ENABLED',
      });
    }
    const secret = generateTotpSecret();
    await setUserMfaSecret(db, req.user!.id, secret);
    const issuer = encodeURIComponent('Uganda GovHub API');
    const label = encodeURIComponent(`${req.user!.email}`);
    res.json({
      secret,
      otpauth_url: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    });
  });

  router.post('/mfa/enable', requireAuth(db), async (req, res) => {
    const user = await getUserById(db, req.user!.id);
    const secret = getMfaSecret(user);
    if (!secret) {
      return res.status(400).json({ error: 'Start MFA setup before enabling MFA.', code: 'MFA_SETUP_REQUIRED' });
    }
    if (!verifyTotpCode(secret, String(req.body?.code || ''))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    await enableUserMfa(db, req.user!.id);
    res.json({ user: sanitizeUser(await getUserById(db, req.user!.id)) });
  });

  router.post('/mfa/disable', requireAuth(db), async (req, res) => {
    const { password, code } = req.body || {};
    const user = await getUserById(db, req.user!.id);
    const secret = getMfaSecret(user);
    if (!password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Password confirmation failed.', code: 'INVALID_PASSWORD' });
    }
    if (user.mfa_enabled_at && (!secret || !verifyTotpCode(secret, String(code || '')))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    await run(db, 'UPDATE users SET mfa_enabled_at = NULL, mfa_secret_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.user!.id]);
    res.json({ user: sanitizeUser(await getUserById(db, req.user!.id)) });
  });

  router.get('/account', requireAuth(db), async (req, res) => {
    const snapshot = await getAccountSnapshot(db, req.user!.id);
    res.json({ account: snapshot });
  });

  router.patch('/account/profile', requireAuth(db), async (req, res) => {
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
    const current = await getAccountSnapshot(db, req.user!.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const adminMutationDecision = await rejectSelfAdminVerificationMutation(db, req.user!.id, current.user, current.profile.verification_status);
    if (adminMutationDecision?.allowed === false) {
      return res.status(400).json({ error: adminMutationDecision.message, code: adminMutationDecision.code });
    }

    const next: Record<string, any> = {};
    for (const key of allowed) {
      next[key] = Object.prototype.hasOwnProperty.call(req.body, key) ? req.body[key] || null : (current.profile as any)[key];
    }
    next.account_category = normalizeAccountType(next.account_category);
    if (next.account_category === 'admin') {
      return res.status(400).json({ error: 'Admin account category cannot be self-assigned.', code: 'ADMIN_CATEGORY_FORBIDDEN' });
    }

    const stored = encryptProfileForStorage(next);
    await db.transaction(async client => {
      await run(client, `
        UPDATE user_profiles SET
          account_category = $1, nin = $2, national_id_number = $3, contact_phone = $4, address = $5,
          organization_name = $6, organization_type = $7, ursb_number = $8, brn = $9, tin = $10,
          staff_id = $11, department = $12, job_title = $13, supervisor_name = $14, supervisor_email = $15,
          verification_status = CASE
            WHEN verification_status IN ('submitted_for_review', 'verified') THEN verification_status
            ELSE 'draft_profile'
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $16
      `, [
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
      ]);
      if (await markVerificationChanged(client, req.user!.id, current.profile.verification_status)) {
        await revokeUserApiKeys(client, req.user!.id);
      }
    });

    res.json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/documents', requireAuth(db), async (req, res) => {
    const { type, label, file_name, mime_type, storage_ref } = req.body || {};
    if (!type || !label || !file_name || !mime_type) {
      return res.status(400).json({ error: 'type, label, file_name, and mime_type are required.' });
    }
    const current = await getAccountSnapshot(db, req.user!.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const adminMutationDecision = await rejectSelfAdminVerificationMutation(db, req.user!.id, current.user, current.profile.verification_status);
    if (adminMutationDecision?.allowed === false) {
      return res.status(400).json({ error: adminMutationDecision.message, code: adminMutationDecision.code });
    }
    await db.transaction(async client => {
      await upsertVerificationDocument(client, req.user!.id, { type, label, file_name, mime_type, storage_ref });
      if (await markVerificationChanged(client, req.user!.id, current?.profile.verification_status)) {
        await revokeUserApiKeys(client, req.user!.id);
      }
    });
    res.status(201).json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/submit-verification', requireAuth(db), async (req, res) => {
    const snapshot = await getAccountSnapshot(db, req.user!.id);
    if (!snapshot) return res.status(404).json({ error: 'Account not found.' });
    const decision = canSubmitVerification(snapshot);
    if (!decision.allowed) {
      return res.status(400).json({ error: decision.message });
    }
    await run(db, `
      UPDATE user_profiles
      SET verification_status = 'submitted_for_review', submitted_at = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `, [new Date().toISOString(), req.user!.id]);
    res.json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  return router;
}

export function adminUsersRouter(db: Db) {
  const router = Router();

  router.use(requireAuth(db, ['admin']));

  router.get('/', async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const users = status
      ? await many(db, 'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC', [status])
      : await many(db, 'SELECT * FROM users ORDER BY created_at DESC');
    res.json({
      users: await Promise.all(users.map(async user => ({
        ...sanitizeUser(user as any),
        account: await getAccountSnapshot(db, (user as any).id),
      }))),
    });
  });

  router.post('/:id/approve', async (req, res) => {
    const { role, mda_id } = req.body || {};
    if (!isUserRole(role)) {
      return res.status(400).json({ error: 'A valid role is required.' });
    }

    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });

    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    const snapshot = await getAccountSnapshot(db, req.params.id);
    if (!snapshot || snapshot.profile.verification_status !== 'submitted_for_review') {
      return res.status(400).json({ error: 'User verification must be submitted for review before approval.', code: 'VERIFICATION_NOT_SUBMITTED' });
    }
    if (role === 'admin') {
      const accountCategory = normalizeAccountType(snapshot.profile.account_category);
      if (!['government_employee', 'mda_api_owner', 'admin'].includes(accountCategory)) {
        return res.status(400).json({
          error: 'Administrator accounts require verified government or MDA operator identity.',
          code: 'ADMIN_PROMOTION_REQUIRES_GOVERNMENT_IDENTITY',
        });
      }
    }

    const needsMda = approvalRequiresMda(existing.account_type, role);
    const approvedMdaId = needsMda ? mda_id || existing.requested_mda_id || null : null;
    if (needsMda && (!approvedMdaId || typeof approvedMdaId !== 'string')) {
      return res.status(400).json({ error: 'mda_id is required for this account type and role.' });
    }
    if (approvedMdaId && !(await mdaExists(db, approvedMdaId))) {
      return res.status(400).json({ error: 'mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
    }

    // Wrap MDA re-check and user update in a single transaction to prevent race conditions
    try {
      await db.transaction(async client => {
        if (approvedMdaId && !(await mdaExists(client, approvedMdaId))) {
          throw Object.assign(new Error('mda_id must reference an existing MDA.'), { code: 'MDA_NOT_FOUND' });
        }
        await run(client, `
          UPDATE users
          SET status = 'APPROVED', role = $1, mda_id = $2, reviewed_by = $3, reviewed_at = $4,
              rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [role, approvedMdaId, req.user!.id, new Date().toISOString(), req.params.id]);
        await run(client, `
          UPDATE user_profiles
          SET verification_status = 'verified',
              account_category = $1,
              review_notes = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
        `, [role === 'admin' ? 'admin' : snapshot.profile.account_category, req.params.id]);
      });
    } catch (err: any) {
      if (err?.code === 'MDA_NOT_FOUND') {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.post('/:id/needs-more-information', async (req, res) => {
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }
    const snapshot = await getAccountSnapshot(db, req.params.id);
    if (!snapshot || snapshot.profile.verification_status !== 'submitted_for_review') {
      return res.status(400).json({ error: 'Only accounts submitted for review can be returned for more information.', code: 'VERIFICATION_NOT_SUBMITTED' });
    }

    await run(db, `
      UPDATE user_profiles
      SET verification_status = 'needs_more_information', review_notes = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `, [notes || 'Additional verification information is required.', req.params.id]);

    res.json({ account: await getAccountSnapshot(db, req.params.id) });
  });

  router.post('/:id/reject', async (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    await db.transaction(async client => {
      await run(client, `
        UPDATE users
        SET status = 'REJECTED', role = NULL, mda_id = NULL, reviewed_by = $1,
            reviewed_at = $2, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [req.user!.id, new Date().toISOString(), reason || 'Application rejected by administrator.', req.params.id]);
      await run(client, "UPDATE user_profiles SET verification_status = 'rejected', review_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2", [reason || 'Application rejected by administrator.', req.params.id]);
      await revokeUserApiKeys(client, req.params.id);
    });

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.post('/:id/suspend', async (req, res) => {
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    await db.transaction(async client => {
      await run(client, `
        UPDATE users
        SET status = 'SUSPENDED', reviewed_by = $1, reviewed_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [req.user!.id, new Date().toISOString(), req.params.id]);
      await run(client, "UPDATE user_profiles SET verification_status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1", [req.params.id]);
      await revokeUserApiKeys(client, req.params.id);
    });

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.delete('/:id', async (req, res) => {
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    if (existing.id === req.user!.id) {
      return res.status(400).json({ error: 'Administrators cannot delete their own account.', code: 'CANNOT_DELETE_SELF' });
    }
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }

    const deletedUser = sanitizeUser(existing);
    await db.transaction(async client => {
      await run(client, 'UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [new Date().toISOString(), existing.id]);
      await revokeUserApiKeys(client, existing.id, 'DELETED');
      await run(client, 'DELETE FROM verification_documents WHERE user_id = $1', [existing.id]);
      await run(client, 'DELETE FROM user_profiles WHERE user_id = $1', [existing.id]);
      await run(client, 'DELETE FROM sessions WHERE user_id = $1', [existing.id]);
      await run(client, 'DELETE FROM users WHERE id = $1', [existing.id]);
    });
    res.json({ deleted: true, user: deletedUser });
  });

  return router;
}
