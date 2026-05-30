import crypto from 'crypto';
import { isProductionEnv } from './security-config';

const PREFIX = 'enc:v1:';

function getEncryptionKey() {
  const raw = process.env.GOVHUB_DATA_ENCRYPTION_KEY;
  if (!raw) {
    if (isProductionEnv()) {
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

function asUint8Array(buffer: Buffer) {
  return Uint8Array.from(buffer);
}

function getEncryptionKeyObject() {
  return crypto.createSecretKey(asUint8Array(getEncryptionKey()));
}

export function isEncryptedAtRest(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptAtRest(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (isEncryptedAtRest(value)) return value;
  const iv = asUint8Array(crypto.randomBytes(12));
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKeyObject(), iv);
  const ciphertext = cipher.update(value, 'utf8', 'base64url') + cipher.final('base64url');
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.from(iv).toString('base64url')}:${Buffer.from(asUint8Array(tag)).toString('base64url')}:${ciphertext}`;
}

export function decryptAtRest(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (!isEncryptedAtRest(value)) return value;
  const [, ivPart, tagPart, ciphertextPart] = value.match(/^enc:v1:([^:]+):([^:]+):(.+)$/) || [];
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Encrypted value is malformed.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKeyObject(), asUint8Array(Buffer.from(ivPart, 'base64url')));
  decipher.setAuthTag(asUint8Array(Buffer.from(tagPart, 'base64url')));
  return decipher.update(ciphertextPart, 'base64url', 'utf8') + decipher.final('utf8');
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
