import assert from 'assert';

const headersModule = require('./security-headers') as {
  securityHeadersForPath?: (path: string, tlsEnabled?: boolean) => Record<string, string>;
};

assert.equal(typeof headersModule.securityHeadersForPath, 'function');

const standardHeaders = headersModule.securityHeadersForPath!('/api/health', false);
assert.equal(standardHeaders['X-Content-Type-Options'], 'nosniff');
assert.equal(standardHeaders['X-Frame-Options'], 'DENY');
assert.equal(standardHeaders['Referrer-Policy'], 'no-referrer');
assert.equal(standardHeaders['Permissions-Policy'], 'camera=(), geolocation=(), microphone=()');
assert.equal(Object.prototype.hasOwnProperty.call(standardHeaders, 'Strict-Transport-Security'), false);
assert.equal(Object.prototype.hasOwnProperty.call(standardHeaders, 'Cache-Control'), false);

const tlsHeaders = headersModule.securityHeadersForPath!('/api/health', true);
assert.equal(tlsHeaders['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');

const sensitiveHeaders = headersModule.securityHeadersForPath!('/api/auth/me', false);
assert.equal(sensitiveHeaders['Cache-Control'], 'no-store');
assert.equal(sensitiveHeaders.Pragma, 'no-cache');

const protectedDocumentationPaths = [
  '/api/docs',
  '/api/docs/api-example',
  '/api/docs/api-example/spec',
  '/api/catalog',
  '/api/catalog/api-example',
  '/api/catalog/api-example/spec',
  '/openapi/api-example.yaml',
];

for (const path of protectedDocumentationPaths) {
  const docsHeaders = headersModule.securityHeadersForPath!(path, false);
  assert.equal(
    docsHeaders['Cache-Control'],
    'no-store',
    `${path} must not be cached because docs/spec responses can depend on authenticated or restricted visibility`,
  );
  assert.equal(docsHeaders.Pragma, 'no-cache');
}
