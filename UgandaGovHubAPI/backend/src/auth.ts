import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { ensureRateLimitSchema } from './rate-limit';
import { decryptAtRest, encryptAtRest } from './crypto-at-rest';
import type { DbClient } from './db';
import { exec, hasColumn, one, run } from './db';
import { shouldRequireAdminMfa } from './security-config';

export const USER_ROLES = ['developer', 'api_owner', 'admin', 'reviewer'] as const;
export type UserRole = typeof USER_ROLES[number];

export const USER_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type UserStatus = typeof USER_STATUSES[number];

export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  account_type: string;
  requested_role: UserRole;
  requested_mda_id: string | null;
  requested_organization: string;
  requested_purpose: string;
  status: UserStatus;
  role: UserRole | null;
  mda_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  mfa_secret_encrypted: string | null;
  mfa_enabled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicUser = Omit<AuthUser, 'password_hash' | 'mfa_secret_encrypted'> & { mfa_enabled: boolean };

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; code: 'UNAUTHENTICATED' | 'ACCOUNT_NOT_APPROVED' | 'ADMIN_MFA_REQUIRED' | 'FORBIDDEN'; message: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'govhub_session';
const MAX_SESSION_TOKEN_LENGTH = 256;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(secret: string) {
  const normalized = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Invalid MFA secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function getTotpCode(secret: string, now = new Date(), stepSeconds = 30) {
  const counter = Math.floor(now.getTime() / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', crypto.createSecretKey(Uint8Array.from(base32Decode(secret))))
    .update(Uint8Array.from(counterBuffer))
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string, now = new Date()) {
  const normalizedCode = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;
  for (const offset of [-1, 0, 1]) {
    const comparisonDate = new Date(now.getTime() + offset * 30_000);
    const expected = getTotpCode(secret, comparisonDate);
    if (crypto.timingSafeEqual(Uint8Array.from(Buffer.from(expected)), Uint8Array.from(Buffer.from(normalizedCode)))) {
      return true;
    }
  }
  return false;
}

export function getMfaSecret(user: Pick<AuthUser, 'mfa_secret_encrypted'>) {
  return decryptAtRest(user.mfa_secret_encrypted);
}

export async function setUserMfaSecret(db: DbClient, userId: string, secret: string) {
  await run(db, 'UPDATE users SET mfa_secret_encrypted = $1, mfa_enabled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [encryptAtRest(secret), userId]);
}

export async function enableUserMfa(db: DbClient, userId: string, now = new Date()) {
  await run(db, 'UPDATE users SET mfa_enabled_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [now.toISOString(), userId]);
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: unknown, storedHash: unknown) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const [algorithm, salt, hash] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(Uint8Array.from(candidate), Uint8Array.from(expected));
}

export async function ensureAuthSchema(db: DbClient) {
  await ensureRateLimitSchema(db);
  await exec(db, `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      account_type TEXT NOT NULL,
      requested_role TEXT NOT NULL,
      requested_mda_id TEXT,
      requested_organization TEXT NOT NULL,
      requested_purpose TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      role TEXT,
      mda_id TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      mfa_secret_encrypted TEXT,
      mfa_enabled_at TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );
  `);
  if (!await hasColumn(db, 'users', 'mfa_secret_encrypted')) await exec(db, 'ALTER TABLE users ADD COLUMN mfa_secret_encrypted TEXT');
  if (!await hasColumn(db, 'users', 'mfa_enabled_at')) await exec(db, 'ALTER TABLE users ADD COLUMN mfa_enabled_at TEXT');
}

export async function ensureDefaultAdmin(db: DbClient) {
  const email = normalizeEmail(process.env.GOVHUB_ADMIN_EMAIL || 'admin@ict.go.ug');
  let password = process.env.GOVHUB_ADMIN_PASSWORD;

  if (!password) {
    if (process.env.GOVHUB_DEMO_MODE !== 'true') {
      throw new Error('GOVHUB_ADMIN_PASSWORD is required unless GOVHUB_DEMO_MODE=true.');
    }
    // Demo mode: generate a random password instead of using a hardcoded fallback
    password = crypto.randomBytes(20).toString('base64url');
    console.warn(`[GOVHUB DEMO] Generated admin password for ${email}: ${password}`);
    console.warn('[GOVHUB DEMO] Set GOVHUB_ADMIN_PASSWORD to persist this across restarts.');
  }

  const existing = await one(db, 'SELECT id FROM users WHERE email = $1', [email]);
  if (existing) return;

  await run(db, `
    INSERT INTO users (
      id, full_name, email, password_hash, account_type, requested_role,
      requested_mda_id, requested_organization, requested_purpose, status,
      role, mda_id, reviewed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, [
    `user-${crypto.randomUUID()}`,
    'Platform Admin',
    email,
    hashPassword(password),
    'government',
    'admin',
    'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
    'Ministry of ICT and National Guidance',
    'Seeded platform administration account',
    'APPROVED',
    'admin',
    'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
    new Date().toISOString()
  ]);
}

type DemoUserSeed = {
  envPrefix: string;
  fallbackEmail: string;
  fallbackPassword: string;
  fullName: string;
  accountType: string;
  requestedRole: UserRole;
  requestedMdaId: string | null;
  organization: string;
  purpose: string;
  status: UserStatus;
  role: UserRole | null;
  mdaId: string | null;
};

const demoUsers: DemoUserSeed[] = [
  {
    envPrefix: 'GOVHUB_DEMO_DEVELOPER',
    fallbackEmail: 'demo.developer@govhub.go.ug',
    fallbackPassword: 'DemoDeveloper123!',
    fullName: 'Demo Developer',
    accountType: 'government_employee',
    requestedRole: 'developer',
    requestedMdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
    organization: 'Ministry of Health',
    purpose: 'Request API access for a ministry service integration',
    status: 'APPROVED',
    role: 'developer',
    mdaId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  },
  {
    envPrefix: 'GOVHUB_DEMO_API_OWNER',
    fallbackEmail: 'demo.api.owner@nira.go.ug',
    fallbackPassword: 'DemoApiOwner123!',
    fullName: 'Demo API Owner',
    accountType: 'mda_api_owner',
    requestedRole: 'api_owner',
    requestedMdaId: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41',
    organization: 'National Identification and Registration Authority',
    purpose: 'Review access requests for NIRA APIs',
    status: 'APPROVED',
    role: 'api_owner',
    mdaId: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41',
  },
  {
    envPrefix: 'GOVHUB_DEMO_REVIEWER',
    fallbackEmail: 'demo.reviewer@govhub.go.ug',
    fallbackPassword: 'DemoReviewer123!',
    fullName: 'Demo Compliance Reviewer',
    accountType: 'government_employee',
    requestedRole: 'reviewer',
    requestedMdaId: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
    organization: 'Ministry of ICT and National Guidance',
    purpose: 'Review audit trails and interoperability compliance',
    status: 'APPROVED',
    role: 'reviewer',
    mdaId: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
  },
  {
    envPrefix: 'GOVHUB_DEMO_PUBLIC_DEVELOPER',
    fallbackEmail: 'demo.public.developer@example.com',
    fallbackPassword: 'DemoPublicDev123!',
    fullName: 'Demo Public Developer',
    accountType: 'public_developer',
    requestedRole: 'developer',
    requestedMdaId: null,
    organization: 'Independent Civic Developer',
    purpose: 'Build a public-facing service using approved APIs',
    status: 'PENDING_REVIEW',
    role: null,
    mdaId: null,
  },
  {
    envPrefix: 'GOVHUB_DEMO_PRIVATE_COMPANY',
    fallbackEmail: 'demo.company@example.com',
    fallbackPassword: 'DemoCompany123!',
    fullName: 'Demo Company Representative',
    accountType: 'private_company',
    requestedRole: 'developer',
    requestedMdaId: null,
    organization: 'Demo Digital Services Ltd',
    purpose: 'Integrate verified company services with government APIs',
    status: 'PENDING_REVIEW',
    role: null,
    mdaId: null,
  },
  {
    envPrefix: 'GOVHUB_DEMO_BUSINESS',
    fallbackEmail: 'demo.business@example.com',
    fallbackPassword: 'DemoBusiness123!',
    fullName: 'Demo Business Owner',
    accountType: 'business_name',
    requestedRole: 'developer',
    requestedMdaId: null,
    organization: 'Demo Registered Business',
    purpose: 'Request API access under a registered business name',
    status: 'PENDING_REVIEW',
    role: null,
    mdaId: null,
  },
  {
    envPrefix: 'GOVHUB_DEMO_RESEARCH',
    fallbackEmail: 'demo.research@example.edu',
    fallbackPassword: 'DemoResearch123!',
    fullName: 'Demo Research Lead',
    accountType: 'research_institution',
    requestedRole: 'developer',
    requestedMdaId: null,
    organization: 'Demo Research Institution',
    purpose: 'Evaluate public-interest API access for approved research',
    status: 'PENDING_REVIEW',
    role: null,
    mdaId: null,
  },
];

export async function ensureDemoUsers(db: DbClient) {
  if (process.env.GOVHUB_DEMO_MODE !== 'true') return;
  for (const demoUser of demoUsers) {
    const email = normalizeEmail(process.env[`${demoUser.envPrefix}_EMAIL`] || demoUser.fallbackEmail);
    const password = process.env[`${demoUser.envPrefix}_PASSWORD`] || demoUser.fallbackPassword;
    const existing = await one(db, 'SELECT id FROM users WHERE email = $1', [email]);
    if (existing) continue;

    await run(db, `
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status,
        role, mda_id, reviewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      `usr_${crypto.randomUUID()}`,
      demoUser.fullName,
      email,
      hashPassword(password),
      demoUser.accountType,
      demoUser.requestedRole,
      demoUser.requestedMdaId,
      demoUser.organization,
      demoUser.purpose,
      demoUser.status,
      demoUser.role,
      demoUser.mdaId,
      demoUser.status === 'APPROVED' ? new Date().toISOString() : null
    ]);
  }
}

export function sanitizeUser(user: AuthUser): PublicUser {
  const { password_hash, mfa_secret_encrypted, ...publicUser } = user;
  return {
    ...publicUser,
    mfa_enabled: Boolean(user.mfa_enabled_at),
  };
}

export async function createSession(db: DbClient, userId: string, now = new Date()) {
  const token = `ghb_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await run(db, `
    INSERT INTO sessions (id, user_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [`session-${crypto.randomUUID()}`, userId, hashToken(token), expiresAt]);
  return token;
}

export async function revokeSession(db: DbClient, token: string) {
  await run(db, 'UPDATE sessions SET revoked_at = $1 WHERE token_hash = $2', [new Date().toISOString(), hashToken(token)]);
}

export async function getSessionUser(db: DbClient, token: string, now = new Date()): Promise<AuthUser | null> {
  const user = await one<AuthUser>(db, `
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > $2
  `, [hashToken(token), now.toISOString()]);
  return user || null;
}

export function getBearerToken(req: Request) {
  const normalizeToken = (value: string | null | undefined) => {
    if (!value) return null;
    return value.length <= MAX_SESSION_TOKEN_LENGTH ? value : null;
  };

  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const bearerToken = header.slice('Bearer '.length).trim();
    if (bearerToken) return normalizeToken(bearerToken);
  }
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    const rawValue = valueParts.join('=');
    try {
      return [name, decodeURIComponent(rawValue)];
    } catch {
      return [name, ''];
    }
  }).filter(([name]) => Boolean(name)));
  const token = cookies[SESSION_COOKIE_NAME];
  return normalizeToken(token);
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

export function canAccess(user: AuthUser | null | undefined, roles?: UserRole[]): AccessDecision {
  if (!user) {
    return { allowed: false, code: 'UNAUTHENTICATED', message: 'Authentication is required.' };
  }
  if (user.status !== 'APPROVED') {
    return { allowed: false, code: 'ACCOUNT_NOT_APPROVED', message: 'This account must be approved by an administrator before accessing this feature.' };
  }
  if (!user.role || (roles && !roles.includes(user.role))) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Your account does not have permission to access this feature.' };
  }
  if (
    shouldRequireAdminMfa() &&
    user.role === 'admin' &&
    roles?.includes('admin') &&
    !user.mfa_enabled_at
  ) {
    return {
      allowed: false,
      code: 'ADMIN_MFA_REQUIRED',
      message: 'Administrator multi-factor authentication is required before using privileged workflows.',
    };
  }
  return { allowed: true };
}

export function requireAuth(db: DbClient, roles?: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    const user = token ? await getSessionUser(db, token) : null;
    if (!roles) {
      if (!user) {
        return res.status(401).json({ error: 'Authentication is required.', code: 'UNAUTHENTICATED' });
      }
      // Suspended accounts must not access any authenticated route
      if (user.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'This account has been suspended.', code: 'ACCOUNT_SUSPENDED' });
      }
      req.user = user;
      return next();
    }
    const decision = canAccess(user, roles);

    if (decision.allowed === false) {
      const status = decision.code === 'UNAUTHENTICATED' ? 401 : decision.code === 'ACCOUNT_NOT_APPROVED' ? 403 : 403;
      return res.status(status).json({ error: decision.message, code: decision.code });
    }

    req.user = user!;
    next();
  };
}

export const requireApprovedAuth = requireAuth;

export function optionalAuth(db: DbClient) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    req.user = token ? await getSessionUser(db, token) || undefined : undefined;
    next();
  };
}
