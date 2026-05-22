import assert from 'assert/strict';
import Database from 'better-sqlite3';
import {
  canAccess,
  createSession,
  ensureAuthSchema,
  getSessionUser,
  hashPassword,
  sanitizeUser,
  verifyPassword,
} from './auth';

const db = new Database(':memory:');
ensureAuthSchema(db);

const passwordHash = hashPassword('StrongPass123!');
assert.notEqual(passwordHash, 'StrongPass123!');
assert.equal(verifyPassword('StrongPass123!', passwordHash), true);
assert.equal(verifyPassword('wrong-password', passwordHash), false);

db.prepare(`
  INSERT INTO users (
    id, full_name, email, password_hash, account_type, requested_role,
    requested_mda_id, requested_organization, requested_purpose, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'user-1',
  'Jane Developer',
  'jane@example.go.ug',
  passwordHash,
  'government',
  'developer',
  'mda-06',
  'Ministry of Health',
  'Build a health service integration',
  'PENDING_REVIEW'
);

const pendingUser = db.prepare('SELECT * FROM users WHERE id = ?').get('user-1') as any;
assert.equal(pendingUser.status, 'PENDING_REVIEW');
const pendingAccess = canAccess(pendingUser, ['developer']);
assert.equal(pendingAccess.allowed, false);
if (!pendingAccess.allowed) {
  assert.equal(pendingAccess.code, 'ACCOUNT_NOT_APPROVED');
}

db.prepare(`
  UPDATE users
  SET status = 'APPROVED', role = 'developer', mda_id = 'mda-06', reviewed_at = ?, reviewed_by = ?
  WHERE id = ?
`).run('2026-05-22T10:00:00.000Z', 'admin-1', 'user-1');

const approvedUser = db.prepare('SELECT * FROM users WHERE id = ?').get('user-1') as any;
assert.equal(canAccess(approvedUser, ['developer']).allowed, true);
const adminAccess = canAccess(approvedUser, ['admin']);
assert.equal(adminAccess.allowed, false);
if (!adminAccess.allowed) {
  assert.equal(adminAccess.code, 'FORBIDDEN');
}

const token = createSession(db, 'user-1', new Date('2026-05-22T10:00:00.000Z'));
assert.equal(typeof token, 'string');
assert.equal(token.length > 40, true);

const sessionUser = getSessionUser(db, token, new Date('2026-05-22T10:01:00.000Z'));
assert.equal(sessionUser?.email, 'jane@example.go.ug');
assert.equal(getSessionUser(db, token, new Date('2026-05-23T10:01:00.000Z')), null);

const publicUser = sanitizeUser(approvedUser);
assert.equal('password_hash' in publicUser, false);
assert.equal(publicUser.role, 'developer');
assert.equal(publicUser.mda_id, 'mda-06');

console.log('auth tests passed');
