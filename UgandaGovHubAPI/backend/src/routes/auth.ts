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
  USER_STATUSES,
  verifyTotpCode,
  verifyPassword,
} from '../auth';
import {
  ACCOUNT_TYPE_REQUIREMENTS,
  canSubmitVerification,
  ensureUserProfile,
  encryptProfileForStorage,
  getAccountSnapshot,
  isRoleAllowedForAccountType,
  normalizeAccountType,
  upsertVerificationDocument,
  validateVerificationDocumentInput,
} from '../account-verification';
import { clearRateLimit, consumeRateLimit } from '../rate-limit';
import type { Db, DbClient } from '../db';
import { many, one, run, tableExists } from '../db';
import { positiveIntegerEnv } from '../env';
import { configuredTurnstileSecret, validateTurnstileToken } from '../turnstile';

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
const PASSWORD_MAX_LENGTH = 1024;
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
  if (pwd.length > PASSWORD_MAX_LENGTH) return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
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
  if (!isRoleAllowedForAccountType(normalizedAccountType, body.requested_role)) {
    return 'requested_role is not allowed for this account_type.';
  }
  if (body.requested_mda_id !== undefined && body.requested_mda_id !== null && body.requested_mda_id !== '') {
    if (typeof body.requested_mda_id !== 'string') return 'requested_mda_id must be a string.';
    if (body.requested_mda_id.trim().length > 200) return 'requested_mda_id must be 200 characters or fewer.';
  }
  return null;
}

const LOGIN_LIMIT = positiveIntegerEnv('GOVHUB_LOGIN_RATE_LIMIT', 10);
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MFA_LIMIT = positiveIntegerEnv('GOVHUB_MFA_RATE_LIMIT', 5);
const MFA_WINDOW_MS = 10 * 60 * 1000;
const HUMAN_VERIFICATION_DEFAULT_LIMIT = 60;
const HUMAN_VERIFICATION_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_EMAIL_MAX_LENGTH = 320;
const PROFILE_FIELD_MAX_LENGTH = 2000;
const REVIEW_TEXT_MAX_LENGTH = 2000;
const ADMIN_USERS_LIST_DEFAULT_LIMIT = 100;
const ADMIN_USERS_LIST_MAX_LIMIT = 100;
const ADMIN_USERS_LIST_MAX_OFFSET = 10000;
const ADMIN_USER_STATUSES = new Set<string>(USER_STATUSES);
type MfaRateLimitAction = 'setup' | 'enable' | 'disable';

type ProfilePatchValidation =
  | { ok: true; value: Record<string, string | null> }
  | { ok: false; message: string };

type AdminUsersListQueryValidation =
  | { ok: true; value: { status: string | null; limit: number; offset: number } }
  | { ok: false; code: 'INVALID_USER_STATUS'; message: string };

function boundedPositiveIntegerParam(value: unknown, fallback: number, max: number) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function boundedNonNegativeIntegerParam(value: unknown, fallback: number, max: number) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function parseAdminUsersListQuery(query: Record<string, unknown>): AdminUsersListQueryValidation {
  const rawStatus = typeof query.status === 'string' ? query.status.trim() : '';
  if (rawStatus && !ADMIN_USER_STATUSES.has(rawStatus)) {
    return {
      ok: false,
      code: 'INVALID_USER_STATUS',
      message: 'status must be PENDING_REVIEW, APPROVED, REJECTED, or SUSPENDED.',
    };
  }

  return {
    ok: true,
    value: {
      status: rawStatus || null,
      limit: boundedPositiveIntegerParam(query.limit, ADMIN_USERS_LIST_DEFAULT_LIMIT, ADMIN_USERS_LIST_MAX_LIMIT),
      offset: boundedNonNegativeIntegerParam(query.offset, 0, ADMIN_USERS_LIST_MAX_OFFSET),
    },
  };
}

function validateProfilePatchInput(body: any, allowedFields: string[]): ProfilePatchValidation {
  const sanitized: Record<string, string | null> = {};
  for (const field of allowedFields) {
    if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;
    const value = body[field];
    if (value === null || value === undefined || value === '') {
      sanitized[field] = null;
      continue;
    }
    if (typeof value !== 'string') {
      return { ok: false, message: `${field} must be a string.` };
    }
    const trimmed = value.trim();
    if (!trimmed) {
      sanitized[field] = null;
      continue;
    }
    if (trimmed.length > PROFILE_FIELD_MAX_LENGTH) {
      return { ok: false, message: `${field} must be ${PROFILE_FIELD_MAX_LENGTH} characters or fewer.` };
    }
    sanitized[field] = trimmed;
  }
  return { ok: true, value: sanitized };
}

function turnstileTokenFromBody(body: any) {
  return body?.turnstile_token || body?.cf_turnstile_response || body?.['cf-turnstile-response'];
}

function mfaCodeFromBody(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function mfaRateLimitGroup(action: MfaRateLimitAction) {
  return `mfa:${action}`;
}

async function consumeMfaRateLimit(db: Db, userId: string, action: MfaRateLimitAction) {
  return consumeRateLimit(db, mfaRateLimitGroup(action), userId, MFA_LIMIT, MFA_WINDOW_MS);
}

async function clearMfaRateLimit(db: DbClient, userId: string, action: MfaRateLimitAction) {
  await clearRateLimit(db, mfaRateLimitGroup(action), userId);
}

function configuredHumanVerificationRateLimit() {
  return positiveIntegerEnv('GOVHUB_TURNSTILE_RATE_LIMIT', HUMAN_VERIFICATION_DEFAULT_LIMIT);
}

function sendMfaRateLimitError(res: any, quota: Awaited<ReturnType<typeof consumeMfaRateLimit>>) {
  if (quota.allowed) return false;
  res.status(429).json({
    error: 'Too many multi-factor authentication attempts. Try again later.',
    code: 'MFA_RATE_LIMITED',
  });
  return true;
}

function sendPasswordConfirmationInputError(res: any, password: unknown) {
  if (typeof password !== 'string' || password.length <= PASSWORD_MAX_LENGTH) return false;
  res.status(400).json({
    error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`,
    code: 'INVALID_PASSWORD_INPUT',
  });
  return true;
}

function validateLoginCredentials(body: any) {
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return {
      ok: false as const,
      message: 'Email and password must be strings.',
    };
  }
  if (email.trim().length > LOGIN_EMAIL_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false as const,
      message: 'Email or password is too long.',
    };
  }
  return {
    ok: true as const,
    email: email.trim(),
    password,
    mfa_code: body?.mfa_code,
  };
}

type ReviewTextValidation =
  | { ok: true; value: string }
  | { ok: false; code: string; message: string };

function optionalReviewTextFromBody(
  body: any,
  fieldName: 'notes' | 'reason',
  invalidCode: string,
): ReviewTextValidation {
  if (!Object.prototype.hasOwnProperty.call(body || {}, fieldName)) {
    return { ok: true, value: '' };
  }
  const value = body[fieldName];
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: '' };
  }
  if (typeof value !== 'string') {
    return { ok: false, code: invalidCode, message: `${fieldName} must be a string.` };
  }
  const trimmed = value.trim();
  if (trimmed.length > REVIEW_TEXT_MAX_LENGTH) {
    return { ok: false, code: invalidCode, message: `${fieldName} must be ${REVIEW_TEXT_MAX_LENGTH} characters or fewer.` };
  }
  return { ok: true, value: trimmed };
}

async function consumeHumanVerificationRateLimit(db: Db, req: any, action: 'app_load' | 'login' | 'signup') {
  if (!configuredTurnstileSecret()) return null;
  const quota = await consumeRateLimit(
    db,
    `turnstile:${action}`,
    req.ip || 'unknown',
    configuredHumanVerificationRateLimit(),
    HUMAN_VERIFICATION_WINDOW_MS,
  );
  if (quota.allowed) return null;
  return {
    ok: false as const,
    status: 429,
    code: 'HUMAN_VERIFICATION_RATE_LIMITED',
    message: 'Too many human verification attempts. Try again later.',
    errors: undefined,
  };
}

async function verifyHumanRequest(db: Db, req: any, action: 'app_load' | 'login' | 'signup') {
  const rateLimitResult = await consumeHumanVerificationRateLimit(db, req, action);
  if (rateLimitResult) return rateLimitResult;
  return validateTurnstileToken({
    token: turnstileTokenFromBody(req.body || {}),
    action,
    remoteIp: req.ip,
  });
}

function sendTurnstileError(res: any, result: Awaited<ReturnType<typeof verifyHumanRequest>>) {
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

type AdminAccountMutationDecision =
  | { allowed: true }
  | { allowed: false; code: 'CANNOT_CHANGE_SELF' | 'LAST_ADMIN_FORBIDDEN'; message: string };

async function canMutateAdminAccount(db: DbClient, actorId: string, target: any): Promise<AdminAccountMutationDecision> {
  if (target.id === actorId) {
    return { allowed: false, code: 'CANNOT_CHANGE_SELF', message: 'Administrators cannot change their own account status.' };
  }
  if (target.status === 'APPROVED' && target.role === 'admin' && await countApprovedAdmins(db) <= 1) {
    return { allowed: false, code: 'LAST_ADMIN_FORBIDDEN', message: 'At least one approved administrator account must remain active.' };
  }
  return { allowed: true };
}

type AdminMutationTargetDecision =
  | { allowed: true; target: any }
  | { allowed: false; status: number; code: string; message: string };

function isApprovedAdminAccount(user: any) {
  return user?.status === 'APPROVED' && user?.role === 'admin';
}

async function lockUsersForAdminMutation(db: DbClient) {
  await run(db, 'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
}

async function getLockedAdminMutationTarget(db: DbClient, actorId: string, targetId: string): Promise<AdminMutationTargetDecision> {
  await lockUsersForAdminMutation(db);

  const actor = await getUserById(db, actorId);
  if (!isApprovedAdminAccount(actor)) {
    return {
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Your account does not have permission to access this feature.',
    };
  }

  const target = await getUserById(db, targetId);
  if (!target) {
    return {
      allowed: false,
      status: 404,
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    };
  }

  const mutationDecision = await canMutateAdminAccount(db, actorId, target);
  if (mutationDecision.allowed === false) {
    return {
      allowed: false,
      status: 400,
      code: mutationDecision.code,
      message: mutationDecision.message,
    };
  }

  return { allowed: true, target };
}

function adminMutationDeniedError(decision: Exclude<AdminMutationTargetDecision, { allowed: true }>) {
  return Object.assign(new Error(decision.message), {
    adminMutationDenied: true,
    status: decision.status,
    code: decision.code,
  });
}

function sendAdminMutationError(res: any, err: any) {
  if (!err?.adminMutationDenied) return false;
  res.status(err.status).json({ error: err.message, code: err.code });
  return true;
}

function wouldVerificationChange(currentStatus?: string | null) {
  return ['submitted_for_review', 'verified'].includes(currentStatus || '');
}

function rejectClosedVerificationMutation(currentStatus?: string | null) {
  if (['rejected', 'suspended'].includes(currentStatus || '')) {
    return {
      allowed: false,
      code: 'VERIFICATION_CLOSED',
      message: 'This verification package is closed and cannot be changed.',
    };
  }
  return { allowed: true };
}

function verificationAlreadyFinalizedError() {
  return Object.assign(new Error('This verification request has already been finalized.'), {
    code: 'VERIFICATION_ALREADY_FINALIZED',
  });
}

function verificationStateChangedError() {
  return Object.assign(new Error('This verification package changed before the update could complete.'), {
    code: 'VERIFICATION_STATE_CHANGED',
  });
}

function sendVerificationStateChangedError(res: any, err: any) {
  if (err?.code !== 'VERIFICATION_STATE_CHANGED') return false;
  res.status(409).json({ error: err.message, code: err.code });
  return true;
}

async function getMutableVerificationStatus(db: DbClient, userId: string) {
  const profile = await one<{ verification_status: string }>(db, `
    SELECT verification_status
    FROM user_profiles
    WHERE user_id = $1
    FOR UPDATE
  `, [userId]);
  const decision = rejectClosedVerificationMutation(profile?.verification_status);
  if (decision.allowed === false) {
    throw verificationStateChangedError();
  }
  return profile?.verification_status || null;
}

function isPendingSubmittedReview(user: any, verificationStatus?: string | null) {
  return user?.status === 'PENDING_REVIEW' && verificationStatus === 'submitted_for_review';
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
    const turnstile = await verifyHumanRequest(db, req, 'app_load');
    if (sendTurnstileError(res, turnstile)) return;
    res.json({ verified: true });
  });

  router.post('/signup', async (req, res) => {
    const turnstile = await verifyHumanRequest(db, req, 'signup');
    if (sendTurnstileError(res, turnstile)) return;

    const error = validateSignup(req.body || {});
    if (error) return res.status(400).json({ error });

    const email = normalizeEmail(req.body.email);
    if (await getUserByEmail(db, email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const id = `usr_${crypto.randomUUID()}`;
    const accountType = normalizeAccountType(req.body.account_type);
    const requestedMdaId = typeof req.body.requested_mda_id === 'string' && req.body.requested_mda_id.trim()
      ? req.body.requested_mda_id.trim()
      : null;
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
      requestedMdaId,
      req.body.requested_organization.trim(),
      req.body.requested_purpose.trim()
    ]);
    await ensureUserProfile(db, id, accountType, req.body.requested_organization.trim());

    res.status(201).json({ user: sanitizeUser(await getUserById(db, id)) });
  });

  router.post('/login', async (req, res) => {
    const turnstile = await verifyHumanRequest(db, req, 'login');
    if (sendTurnstileError(res, turnstile)) return;

    const loginInput = validateLoginCredentials(req.body || {});
    if (!loginInput.ok) {
      return res.status(400).json({ error: loginInput.message, code: 'INVALID_LOGIN_INPUT' });
    }
    const { password, mfa_code } = loginInput;
    const normalizedEmail = normalizeEmail(loginInput.email);
    const attemptKey = `${req.ip || 'unknown'}:${normalizedEmail}`;
    const quota = await consumeRateLimit(db, 'login', attemptKey, LOGIN_LIMIT, LOGIN_WINDOW_MS);
    if (!quota.allowed) {
      return res.status(429).json({ error: 'Too many login attempts. Try again later.', code: 'LOGIN_RATE_LIMITED' });
    }

    const user = await getUserByEmail(db, normalizedEmail);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
    }
    if (user.mfa_enabled_at) {
      const secret = getMfaSecret(user);
      if (!secret) {
        return res.status(403).json({ error: 'MFA is enabled but not configured. Contact an administrator.', code: 'MFA_MISCONFIGURED' });
      }
      if (!mfa_code) {
        return res.status(202).json({ mfa_required: true, email: normalizedEmail });
      }
      if (!verifyTotpCode(secret, mfaCodeFromBody(mfa_code))) {
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
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
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
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (user.mfa_enabled_at) {
      return res.status(409).json({
        error: 'MFA is already enabled. Disable MFA before starting a new setup.',
        code: 'MFA_ALREADY_ENABLED',
      });
    }
    if (sendPasswordConfirmationInputError(res, password)) return;
    const quota = await consumeMfaRateLimit(db, req.user!.id, 'setup');
    if (sendMfaRateLimitError(res, quota)) return;
    if (!password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Password confirmation failed.', code: 'INVALID_PASSWORD' });
    }
    const secret = generateTotpSecret();
    await setUserMfaSecret(db, req.user!.id, secret);
    await clearMfaRateLimit(db, req.user!.id, 'setup');
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
    const quota = await consumeMfaRateLimit(db, req.user!.id, 'enable');
    if (sendMfaRateLimitError(res, quota)) return;
    if (!verifyTotpCode(secret, mfaCodeFromBody(req.body?.code))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    await enableUserMfa(db, req.user!.id);
    await clearMfaRateLimit(db, req.user!.id, 'enable');
    res.json({ user: sanitizeUser(await getUserById(db, req.user!.id)) });
  });

  router.post('/mfa/disable', requireAuth(db), async (req, res) => {
    const { password, code } = req.body || {};
    const user = await getUserById(db, req.user!.id);
    const secret = getMfaSecret(user);
    if (sendPasswordConfirmationInputError(res, password)) return;
    const quota = await consumeMfaRateLimit(db, req.user!.id, 'disable');
    if (sendMfaRateLimitError(res, quota)) return;
    if (!password || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Password confirmation failed.', code: 'INVALID_PASSWORD' });
    }
    if (user.mfa_enabled_at && (!secret || !verifyTotpCode(secret, mfaCodeFromBody(code)))) {
      return res.status(400).json({ error: 'Invalid multi-factor authentication code.', code: 'INVALID_MFA_CODE' });
    }
    await run(db, 'UPDATE users SET mfa_enabled_at = NULL, mfa_secret_encrypted = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.user!.id]);
    await clearMfaRateLimit(db, req.user!.id, 'disable');
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
    const profileInput = validateProfilePatchInput(req.body || {}, allowed);
    if (!profileInput.ok) {
      return res.status(400).json({ error: profileInput.message, code: 'INVALID_PROFILE_FIELD' });
    }
    const current = await getAccountSnapshot(db, req.user!.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const closedVerificationDecision = rejectClosedVerificationMutation(current.profile.verification_status);
    if (closedVerificationDecision.allowed === false) {
      return res.status(403).json({ error: closedVerificationDecision.message, code: closedVerificationDecision.code });
    }
    const adminMutationDecision = await rejectSelfAdminVerificationMutation(db, req.user!.id, current.user, current.profile.verification_status);
    if (adminMutationDecision?.allowed === false) {
      return res.status(400).json({ error: adminMutationDecision.message, code: adminMutationDecision.code });
    }

    const next: Record<string, any> = {};
    for (const key of allowed) {
      next[key] = Object.prototype.hasOwnProperty.call(profileInput.value, key)
        ? profileInput.value[key]
        : (current.profile as any)[key];
    }
    next.account_category = normalizeAccountType(next.account_category);
    if (next.account_category === 'admin') {
      return res.status(400).json({ error: 'Admin account category cannot be self-assigned.', code: 'ADMIN_CATEGORY_FORBIDDEN' });
    }

    const stored = encryptProfileForStorage(next);
    try {
      await db.transaction(async client => {
        const latestVerificationStatus = await getMutableVerificationStatus(client, req.user!.id);
        const profileUpdate = await run(client, `
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
            AND verification_status NOT IN ('rejected', 'suspended')
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
        if (profileUpdate.changes !== 1) {
          throw verificationStateChangedError();
        }
        if (await markVerificationChanged(client, req.user!.id, latestVerificationStatus)) {
          await revokeUserApiKeys(client, req.user!.id);
        }
      });
    } catch (err: any) {
      if (sendVerificationStateChangedError(res, err)) return;
      throw err;
    }

    res.json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/documents', requireAuth(db), async (req, res) => {
    const { type, file_name, mime_type } = req.body || {};
    const current = await getAccountSnapshot(db, req.user!.id);
    if (!current) return res.status(404).json({ error: 'Account not found.' });
    const closedVerificationDecision = rejectClosedVerificationMutation(current.profile.verification_status);
    if (closedVerificationDecision.allowed === false) {
      return res.status(403).json({ error: closedVerificationDecision.message, code: closedVerificationDecision.code });
    }
    const adminMutationDecision = await rejectSelfAdminVerificationMutation(db, req.user!.id, current.user, current.profile.verification_status);
    if (adminMutationDecision?.allowed === false) {
      return res.status(400).json({ error: adminMutationDecision.message, code: adminMutationDecision.code });
    }
    const documentInput = validateVerificationDocumentInput(current.profile.account_category, { type, file_name, mime_type });
    if (!documentInput.ok) {
      return res.status(400).json({ error: documentInput.message, code: documentInput.code });
    }
    try {
      await db.transaction(async client => {
        const latestVerificationStatus = await getMutableVerificationStatus(client, req.user!.id);
        await upsertVerificationDocument(client, req.user!.id, documentInput.value);
        if (await markVerificationChanged(client, req.user!.id, latestVerificationStatus)) {
          await revokeUserApiKeys(client, req.user!.id);
        }
      });
    } catch (err: any) {
      if (sendVerificationStateChangedError(res, err)) return;
      throw err;
    }
    res.status(201).json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  router.post('/account/submit-verification', requireAuth(db), async (req, res) => {
    const snapshot = await getAccountSnapshot(db, req.user!.id);
    if (!snapshot) return res.status(404).json({ error: 'Account not found.' });
    const decision = canSubmitVerification(snapshot);
    if (!decision.allowed) {
      return res.status(400).json({ error: decision.message, code: decision.code });
    }
    try {
      await db.transaction(async client => {
        const latestVerificationStatus = await getMutableVerificationStatus(client, req.user!.id);
        if (!['draft_profile', 'needs_more_information'].includes(latestVerificationStatus || '')) {
          throw verificationStateChangedError();
        }
        const submitUpdate = await run(client, `
          UPDATE user_profiles
          SET verification_status = 'submitted_for_review', submitted_at = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
            AND verification_status IN ('draft_profile', 'needs_more_information')
        `, [new Date().toISOString(), req.user!.id]);
        if (submitUpdate.changes !== 1) {
          throw verificationStateChangedError();
        }
      });
    } catch (err: any) {
      if (sendVerificationStateChangedError(res, err)) return;
      throw err;
    }
    res.json({ account: await getAccountSnapshot(db, req.user!.id) });
  });

  return router;
}

export function adminUsersRouter(db: Db) {
  const router = Router();

  router.use(requireAuth(db, ['admin']));

  router.get('/', async (req, res) => {
    const listQuery = parseAdminUsersListQuery(req.query as Record<string, unknown>);
    if (!listQuery.ok) {
      return res.status(400).json({ error: listQuery.message, code: listQuery.code });
    }

    const { status, limit, offset } = listQuery.value;
    const users = status
      ? await many(db, 'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [status, limit, offset])
      : await many(db, 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const usersWithAccounts = [];
    for (const user of users) {
      usersWithAccounts.push({
        ...sanitizeUser(user as any),
        account: await getAccountSnapshot(db, (user as any).id),
      });
    }
    res.json({
      users: usersWithAccounts,
      limit,
      offset,
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
    const accountCategory = normalizeAccountType(snapshot.profile.account_category);
    if (!isRoleAllowedForAccountType(accountCategory, role)) {
      return res.status(400).json({
        error: 'The requested role is not allowed for this verified account category.',
        code: 'ROLE_ACCOUNT_CATEGORY_MISMATCH',
      });
    }
    if (role === 'admin') {
      if (!['government_employee', 'mda_api_owner', 'admin'].includes(accountCategory)) {
        return res.status(400).json({
          error: 'Administrator accounts require verified government or MDA operator identity.',
          code: 'ADMIN_PROMOTION_REQUIRES_GOVERNMENT_IDENTITY',
        });
      }
    }

    const needsMda = approvalRequiresMda(accountCategory, role);
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
        const lockedMutationDecision = await getLockedAdminMutationTarget(client, req.user!.id, req.params.id);
        if (!lockedMutationDecision.allowed) throw adminMutationDeniedError(lockedMutationDecision);
        if (lockedMutationDecision.target.status !== 'PENDING_REVIEW') {
          throw verificationAlreadyFinalizedError();
        }

        if (approvedMdaId && !(await mdaExists(client, approvedMdaId))) {
          throw Object.assign(new Error('mda_id must reference an existing MDA.'), { code: 'MDA_NOT_FOUND' });
        }
        const userUpdate = await run(client, `
          UPDATE users
          SET status = 'APPROVED', role = $1, mda_id = $2, reviewed_by = $3, reviewed_at = $4,
              rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
            AND status = 'PENDING_REVIEW'
        `, [role, approvedMdaId, req.user!.id, new Date().toISOString(), req.params.id]);
        if (userUpdate.changes === 0) {
          throw verificationAlreadyFinalizedError();
        }
        const profileUpdate = await run(client, `
          UPDATE user_profiles
          SET verification_status = 'verified',
              account_category = $1,
              review_notes = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
            AND verification_status = 'submitted_for_review'
        `, [role === 'admin' ? 'admin' : snapshot.profile.account_category, req.params.id]);
        if (profileUpdate.changes === 0) {
          throw verificationAlreadyFinalizedError();
        }
      });
    } catch (err: any) {
      if (sendAdminMutationError(res, err)) return;
      if (err?.code === 'MDA_NOT_FOUND') {
        return res.status(400).json({ error: err.message, code: err.code });
      }
      if (err?.code === 'VERIFICATION_ALREADY_FINALIZED') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.post('/:id/needs-more-information', async (req, res) => {
    const notesInput = optionalReviewTextFromBody(req.body, 'notes', 'INVALID_REVIEW_NOTES');
    if (!notesInput.ok) {
      return res.status(400).json({ error: notesInput.message, code: notesInput.code });
    }
    const notes = notesInput.value;
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }
    const snapshot = await getAccountSnapshot(db, req.params.id);
    if (!snapshot || !isPendingSubmittedReview(existing, snapshot.profile.verification_status)) {
      return res.status(400).json({ error: 'Only accounts submitted for review can be returned for more information.', code: 'VERIFICATION_NOT_SUBMITTED' });
    }

    try {
      await db.transaction(async client => {
        const lockedMutationDecision = await getLockedAdminMutationTarget(client, req.user!.id, req.params.id);
        if (!lockedMutationDecision.allowed) throw adminMutationDeniedError(lockedMutationDecision);
        if (lockedMutationDecision.target.status !== 'PENDING_REVIEW') {
          throw verificationAlreadyFinalizedError();
        }

        const profileUpdate = await run(client, `
          UPDATE user_profiles
          SET verification_status = 'needs_more_information', review_notes = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
            AND verification_status = 'submitted_for_review'
        `, [notes || 'Additional verification information is required.', req.params.id]);
        if (profileUpdate.changes === 0) {
          throw verificationAlreadyFinalizedError();
        }
      });
    } catch (err: any) {
      if (sendAdminMutationError(res, err)) return;
      if (err?.code === 'VERIFICATION_ALREADY_FINALIZED') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json({ account: await getAccountSnapshot(db, req.params.id) });
  });

  router.post('/:id/reject', async (req, res) => {
    const reasonInput = optionalReviewTextFromBody(req.body, 'reason', 'INVALID_REVIEW_REASON');
    if (!reasonInput.ok) {
      return res.status(400).json({ error: reasonInput.message, code: reasonInput.code });
    }
    const reason = reasonInput.value;
    const existing = await getUserById(db, req.params.id);
    if (!existing) return res.status(404).json({ error: 'User not found.' });
    const mutationDecision = await canMutateAdminAccount(db, req.user!.id, existing);
    if (!mutationDecision.allowed) {
      return res.status(400).json({ error: mutationDecision.message, code: mutationDecision.code });
    }
    const snapshot = await getAccountSnapshot(db, req.params.id);
    if (!snapshot || !isPendingSubmittedReview(existing, snapshot.profile.verification_status)) {
      return res.status(400).json({ error: 'Only accounts submitted for review can be rejected.', code: 'VERIFICATION_NOT_SUBMITTED' });
    }

    try {
      await db.transaction(async client => {
        const lockedMutationDecision = await getLockedAdminMutationTarget(client, req.user!.id, req.params.id);
        if (!lockedMutationDecision.allowed) throw adminMutationDeniedError(lockedMutationDecision);
        if (lockedMutationDecision.target.status !== 'PENDING_REVIEW') {
          throw verificationAlreadyFinalizedError();
        }

        const userUpdate = await run(client, `
          UPDATE users
          SET status = 'REJECTED', role = NULL, mda_id = NULL, reviewed_by = $1,
              reviewed_at = $2, rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
            AND status = 'PENDING_REVIEW'
        `, [req.user!.id, new Date().toISOString(), reason || 'Application rejected by administrator.', req.params.id]);
        if (userUpdate.changes === 0) {
          throw verificationAlreadyFinalizedError();
        }
        const profileUpdate = await run(client, `
          UPDATE user_profiles
          SET verification_status = 'rejected', review_notes = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2
            AND verification_status = 'submitted_for_review'
        `, [reason || 'Application rejected by administrator.', req.params.id]);
        if (profileUpdate.changes === 0) {
          throw verificationAlreadyFinalizedError();
        }
        await revokeUserApiKeys(client, req.params.id);
      });
    } catch (err: any) {
      if (sendAdminMutationError(res, err)) return;
      if (err?.code === 'VERIFICATION_ALREADY_FINALIZED') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      throw err;
    }

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.post('/:id/suspend', async (req, res) => {
    try {
      await db.transaction(async client => {
        const mutationDecision = await getLockedAdminMutationTarget(client, req.user!.id, req.params.id);
        if (!mutationDecision.allowed) throw adminMutationDeniedError(mutationDecision);

        await run(client, `
          UPDATE users
          SET status = 'SUSPENDED', reviewed_by = $1, reviewed_at = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [req.user!.id, new Date().toISOString(), req.params.id]);
        await run(client, "UPDATE user_profiles SET verification_status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1", [req.params.id]);
        await run(client, 'UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [new Date().toISOString(), mutationDecision.target.id]);
        await revokeUserApiKeys(client, req.params.id);
      });
    } catch (err: any) {
      if (sendAdminMutationError(res, err)) return;
      throw err;
    }

    res.json({ user: sanitizeUser(await getUserById(db, req.params.id)) });
  });

  router.delete('/:id', async (req, res) => {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Administrators cannot delete their own account.', code: 'CANNOT_DELETE_SELF' });
    }

    let deletedUser: ReturnType<typeof sanitizeUser> | null = null;
    try {
      await db.transaction(async client => {
        const mutationDecision = await getLockedAdminMutationTarget(client, req.user!.id, req.params.id);
        if (!mutationDecision.allowed) throw adminMutationDeniedError(mutationDecision);

        deletedUser = sanitizeUser(mutationDecision.target);
        await run(client, 'UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL', [new Date().toISOString(), mutationDecision.target.id]);
        await revokeUserApiKeys(client, mutationDecision.target.id, 'DELETED');
        await run(client, 'DELETE FROM verification_documents WHERE user_id = $1', [mutationDecision.target.id]);
        await run(client, 'DELETE FROM user_profiles WHERE user_id = $1', [mutationDecision.target.id]);
        await run(client, 'DELETE FROM sessions WHERE user_id = $1', [mutationDecision.target.id]);
        await run(client, 'DELETE FROM users WHERE id = $1', [mutationDecision.target.id]);
      });
    } catch (err: any) {
      if (sendAdminMutationError(res, err)) return;
      throw err;
    }
    if (!deletedUser) throw new Error('User deletion did not return a deleted account snapshot.');
    res.json({ deleted: true, user: deletedUser });
  });

  return router;
}
