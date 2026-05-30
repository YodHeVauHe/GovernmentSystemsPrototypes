import assert from 'assert/strict';
import { hashPassword, verifyPassword } from './auth';

const passwordHash = hashPassword('StrongPass123!');

assert.equal(verifyPassword('StrongPass123!', passwordHash), true);
assert.equal(verifyPassword('wrong-password', passwordHash), false);
assert.equal(verifyPassword({ password: 'StrongPass123!' } as any, passwordHash), false);
assert.equal(verifyPassword('StrongPass123!', null as any), false);
assert.equal(verifyPassword('StrongPass123!', 'not-a-valid-password-hash'), false);

console.log('auth password validation tests passed');
