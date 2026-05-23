import crypto from 'crypto';

export function generatePublicId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function generateApiKey() {
  return `ghk_${crypto.randomBytes(32).toString('hex')}`;
}
