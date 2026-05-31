import dns from 'dns/promises';
import http from 'http';
import https from 'https';
import net from 'net';
import { StringDecoder } from 'string_decoder';
import { positiveIntegerEnv } from './env';
import { isProductionEnv } from './security-config';

type ResolvedAddress = {
  address: string;
  family: number;
};

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

function firstHeaderValue(value: string | string[] | number | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === 'number') return String(value);
  return value ?? null;
}

function pinnedLookupFor(resolvedAddress: ResolvedAddress): net.LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      const callbackWithAddresses = callback as (
        error: NodeJS.ErrnoException | null,
        addresses: ResolvedAddress[],
      ) => void;
      callbackWithAddresses(null, [resolvedAddress]);
      return;
    }
    const callbackWithAddress = callback as unknown as (
      error: NodeJS.ErrnoException | null,
      address: string,
      family: number,
    ) => void;
    callbackWithAddress(null, resolvedAddress.address, resolvedAddress.family);
  };
}

function requestSpecTextWithinLimit(
  parsed: URL,
  resolvedAddress: ResolvedAddress,
  timeoutMs: number,
  maxBytes: number,
) {
  const client = parsed.protocol === 'https:' ? https : http;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (content: string) => {
      if (settled) return;
      settled = true;
      resolve(content);
    };

    const request = client.request(
      parsed,
      {
        method: 'GET',
        headers: {
          accept: 'application/yaml,text/yaml,application/json,text/plain,*/*',
        },
        lookup: pinnedLookupFor(resolvedAddress),
      },
      response => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          fail(new Error(`Failed to fetch spec from URL: ${response.statusMessage || `HTTP ${statusCode}`}`));
          return;
        }

        let contentLength: number | null;
        try {
          contentLength = parsedContentLength(firstHeaderValue(response.headers['content-length']));
        } catch (error) {
          response.resume();
          fail(error instanceof Error ? error : new Error('Specification content length is invalid.'));
          return;
        }
        if (contentLength !== null && contentLength > maxBytes) {
          response.resume();
          fail(specContentTooLargeError());
          return;
        }

        const decoder = new StringDecoder('utf8');
        const chunks: string[] = [];
        let totalBytes = 0;
        response.on('data', chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.byteLength;
          if (totalBytes > maxBytes) {
            const error = specContentTooLargeError();
            fail(error);
            response.destroy(error);
            request.destroy(error);
            return;
          }
          chunks.push(decoder.write(buffer));
        });
        response.on('end', () => {
          chunks.push(decoder.end());
          succeed(chunks.join(''));
        });
        response.on('error', error => fail(error instanceof Error ? error : new Error(String(error))));
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Spec URL fetch timed out.'));
    });
    request.on('error', error => fail(error instanceof Error ? error : new Error(String(error))));
    request.end();
  });
}

/**
 * Resolve, validate, and fetch a remote OpenAPI spec.
 *
 * SSRF mitigation: resolve the hostname before the request, reject local,
 * private, documentation, multicast, and reserved address ranges, then pin
 * the request to the already-vetted address to avoid DNS rebinding.
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

  const timeoutMs = positiveIntegerEnv('GOVHUB_SPEC_FETCH_TIMEOUT_MS', 5000);
  const maxBytes = positiveIntegerEnv('GOVHUB_SPEC_MAX_BYTES', 1024 * 1024);
  return requestSpecTextWithinLimit(parsed, addresses[0], timeoutMs, maxBytes);
}
