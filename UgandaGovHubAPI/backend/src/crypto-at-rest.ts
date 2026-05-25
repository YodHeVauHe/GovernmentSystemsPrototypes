import crypto from 'crypto';

const PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const raw = process.env.GOVHUB_DATA_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.GOVHUB_DEMO_MODE !== 'true' && process.env.NODE_ENV === 'production') {
      throw new Error('GOVHUB_DATA_ENCRYPTION_KEY is required in production.');
    }
    return crypto.createHash('sha256').update('govhub-demo-development-encryption-key').digest();
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to hash arbitrary passphrase input.
  }
  return crypto.createHash('sha256').update(raw).digest();
}

export function isEncryptedAtRest(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptAtRest(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (isEncryptedAtRest(value)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptAtRest(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (!isEncryptedAtRest(value)) return value;
  const [, ivPart, tagPart, ciphertextPart] = value.match(/^enc:v1:([^:]+):([^:]+):(.+)$/) || [];
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Encrypted value is malformed.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptFields<T extends Record<string, any>>(row: T, fields: string[]): T {
  const next: Record<string, any> = { ...row };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = encryptAtRest(next[field]);
    }
  }
  return next as T;
}

export function decryptFields<T extends Record<string, any>>(row: T, fields: string[]): T {
  const next: Record<string, any> = { ...row };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      next[field] = decryptAtRest(next[field]);
    }
  }
  return next as T;
}
