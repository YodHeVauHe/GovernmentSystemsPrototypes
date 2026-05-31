const sensitiveHeaderNames = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'password',
  'passwd',
  'x-api-key',
  'x-govhub-api-key',
]);

export function isSensitiveHeaderName(name: string) {
  const normalized = name.trim().toLowerCase();
  return (
    sensitiveHeaderNames.has(normalized)
    || normalized.includes('api-key')
    || normalized.includes('apikey')
    || normalized.includes('credential')
    || normalized.includes('password')
    || normalized.includes('passphrase')
    || normalized.includes('secret')
    || normalized.includes('token')
  );
}

export function redactHeaderMap(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeaderName(name) ? '[REDACTED]' : value,
    ]),
  );
}
