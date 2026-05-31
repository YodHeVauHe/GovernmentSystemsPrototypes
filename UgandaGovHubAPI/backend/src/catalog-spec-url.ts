import dns from 'dns/promises';
import net from 'net';
import { positiveIntegerEnv } from './env';
import { isProductionEnv } from './security-config';

function normalizeIpAddress(address: string) {
  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mappedIpv4) return mappedIpv4[1];

  const mappedIpv4Hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (mappedIpv4Hex) {
    return ipv4FromHexWords(mappedIpv4Hex[1], mappedIpv4Hex[2]);
  }

  const expandedMappedIpv4 = /^0{1,4}:0{1,4}:0{1,4}:0{1,4}:0{1,4}:ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (expandedMappedIpv4) return expandedMappedIpv4[1];

  const expandedMappedIpv4Hex = /^0{1,4}:0{1,4}:0{1,4}:0{1,4}:0{1,4}:ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (expandedMappedIpv4Hex) {
    return ipv4FromHexWords(expandedMappedIpv4Hex[1], expandedMappedIpv4Hex[2]);
  }

  const nat64Ipv4 = /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (nat64Ipv4) return nat64Ipv4[1];

  const nat64Ipv4Hex = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (nat64Ipv4Hex) {
    return ipv4FromHexWords(nat64Ipv4Hex[1], nat64Ipv4Hex[2]);
  }

  return address;
}

function ipv4FromHexWords(highWord: string, lowWord: string) {
  const high = Number.parseInt(highWord, 16);
  const low = Number.parseInt(lowWord, 16);
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

function isBlockedIp(address: string) {
  address = normalizeIpAddress(address);
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    const firstHextet = Number.parseInt(normalized.split(':')[0] || '0', 16);
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
      normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8') ||
      normalized.startsWith('2001:2') ||
      normalized.startsWith('2002:')
    );
  }

  return true;
}

function specContentTooLargeError() {
  return new Error('Specification content is too large.');
}

function parsedContentLength(value: string | null) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) {
    throw new Error('Specification content length is invalid.');
  }
  return Number(value);
}

async function readResponseTextWithinLimit(response: Response, maxBytes: number) {
  if (!response.body) {
    const content = await response.text();
    if (Buffer.byteLength(content, 'utf8') > maxBytes) {
      throw specContentTooLargeError();
    }
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw specContentTooLargeError();
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
}

/**
 * Resolve, validate, and fetch a remote OpenAPI spec.
 *
 * SSRF mitigation: resolve the hostname before fetch and reject local,
 * private, documentation, multicast, and reserved address ranges.
 */
export async function fetchSpecFromUrl(specUrl: string): Promise<string> {
  const parsed = new URL(specUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https spec URLs are supported.');
  }
  if (isProductionEnv() && parsed.protocol !== 'https:') {
    throw new Error('Spec URL imports must use https in production.');
  }

  const allowedHosts = (process.env.GOVHUB_SPEC_URL_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);
  const allowUnlistedHosts = process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS === 'true';
  if (!allowedHosts.length && !allowUnlistedHosts) {
    throw new Error('Spec URL imports require GOVHUB_SPEC_URL_HOSTS or GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true.');
  }
  if (allowedHosts.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error('Spec URL host is not allowed.');
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: false });
  if (!addresses.length) {
    throw new Error('Spec URL hostname could not be resolved.');
  }
  const blocked = addresses.filter(a => isBlockedIp(a.address));
  if (blocked.length) {
    throw new Error('Spec URL resolves to a blocked private or local address.');
  }

  const controller = new AbortController();
  const timeoutMs = positiveIntegerEnv('GOVHUB_SPEC_FETCH_TIMEOUT_MS', 5000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch spec from URL: ${response.statusText}`);
    }

    const maxBytes = positiveIntegerEnv('GOVHUB_SPEC_MAX_BYTES', 1024 * 1024);
    const contentLength = parsedContentLength(response.headers.get('content-length'));
    if (contentLength !== null && contentLength > maxBytes) {
      throw specContentTooLargeError();
    }
    return readResponseTextWithinLimit(response, maxBytes);
  } finally {
    clearTimeout(timer);
  }
}
