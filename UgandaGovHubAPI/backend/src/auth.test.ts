import assert from 'assert/strict';
import {
  canAccess,
  createSession,
  ensureAuthSchema,
  getSessionUser,
  hashPassword,
  sanitizeUser,
  verifyPassword,
} from './auth';
import { withPostgresTestDb } from './postgres-test-db';

async function main() {
  await withPostgresTestDb(async db => {
    await ensureAuthSchema(db);

    const passwordHash = hashPassword('StrongPass123!');
    assert.notEqual(passwordHash, 'StrongPass123!');
    assert.equal(verifyPassword('StrongPass123!', passwordHash), true);
    assert.equal(verifyPassword('wrong-password', passwordHash), false);

    await db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, account_type, requested_role,
        requested_mda_id, requested_organization, requested_purpose, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'user-auth-test-1',
      'Jane Developer',
      'jane.auth-test@example.go.ug',
      passwordHash,
      'government',
      'developer',
      'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
      'Ministry of Health',
      'Build a health service integration',
      'PENDING_REVIEW'
    );

    const pendingUser = await db.prepare('SELECT * FROM users WHERE id = ?').get<any>('user-auth-test-1');
    assert.equal(pendingUser.status, 'PENDING_REVIEW');
    const pendingAccess = canAccess(pendingUser, ['developer']);
    assert.equal(pendingAccess.allowed, false);
    if (!pendingAccess.allowed) {
      assert.equal(pendingAccess.code, 'ACCOUNT_NOT_APPROVED');
    }

    await db.prepare(`
      UPDATE users
      SET status = 'APPROVED', role = 'developer', mda_id = 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', reviewed_at = ?, reviewed_by = ?
      WHERE id = ?
    `).run('2026-05-22T10:00:00.000Z', 'admin-1', 'user-auth-test-1');

    const approvedUser = await db.prepare('SELECT * FROM users WHERE id = ?').get<any>('user-auth-test-1');
    assert.equal(canAccess(approvedUser, ['developer']).allowed, true);
    const adminAccess = canAccess(approvedUser, ['admin']);
    assert.equal(adminAccess.allowed, false);
    if (!adminAccess.allowed) {
      assert.equal(adminAccess.code, 'FORBIDDEN');
    }

    const token = await createSession(db, 'user-auth-test-1', new Date('2026-05-22T10:00:00.000Z'));
    assert.equal(typeof token, 'string');
    assert.equal(token.length > 40, true);

    const sessionUser = await getSessionUser(db, token, new Date('2026-05-22T10:01:00.000Z'));
    assert.equal(sessionUser?.email, 'jane.auth-test@example.go.ug');
    assert.equal(await getSessionUser(db, token, new Date('2026-05-23T10:01:00.000Z')), null);

    const publicUser = sanitizeUser(approvedUser);
    assert.equal('password_hash' in publicUser, false);
    assert.equal(publicUser.role, 'developer');
    assert.equal(publicUser.mda_id, 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543');
  });
}

main().then(() => {
  console.log('auth tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
