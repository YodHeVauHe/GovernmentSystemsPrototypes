import assert from 'assert';
import { decryptAtRest, encryptAtRest } from './crypto-at-rest';

const originalEncryptionKey = process.env.GOVHUB_DATA_ENCRYPTION_KEY;

try {
  process.env.GOVHUB_DATA_ENCRYPTION_KEY = '0'.repeat(64);

  const alreadyEncrypted = encryptAtRest('stored secret');
  assert.equal(
    encryptAtRest(alreadyEncrypted),
    alreadyEncrypted,
    'encryptAtRest should remain idempotent for values it can decrypt with the active key.',
  );

  const forgedEncryptedPrefix = 'enc:v1:not-a-valid-envelope';
  const stored = encryptAtRest(forgedEncryptedPrefix);

  assert.notEqual(
    stored,
    forgedEncryptedPrefix,
    'client-supplied encrypted-looking plaintext must be encrypted, not trusted as stored ciphertext.',
  );
  assert.equal(
    decryptAtRest(stored),
    forgedEncryptedPrefix,
    'encrypted-looking plaintext should round-trip after being stored safely.',
  );
} finally {
  if (originalEncryptionKey === undefined) delete process.env.GOVHUB_DATA_ENCRYPTION_KEY;
  else process.env.GOVHUB_DATA_ENCRYPTION_KEY = originalEncryptionKey;
}
