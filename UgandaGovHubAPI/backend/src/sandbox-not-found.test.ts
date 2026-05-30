import assert from 'assert/strict';
import { sandboxNotFoundHandler } from './middleware/sandbox';

function createResponseCapture() {
  const capture = {
    statusCode: 0,
    body: null as any,
    headers: new Map<string, unknown>([['X-Correlation-ID', 'sandbox-request-1']]),
  };
  return {
    capture,
    res: {
      setHeader(name: string, value: unknown) {
        capture.headers.set(name, value);
      },
      getHeader(name: string) {
        return capture.headers.get(name);
      },
      status(code: number) {
        capture.statusCode = code;
        return this;
      },
      json(body: any) {
        capture.body = body;
        return this;
      },
    },
  };
}

const { capture, res } = createResponseCapture();
sandboxNotFoundHandler({
  method: 'GET',
  originalUrl: '/api/v1/identity/unpublished-endpoint',
} as any, res as any);

assert.equal(capture.statusCode, 404);
assert.equal(capture.body.error.code, 'SANDBOX_ENDPOINT_NOT_FOUND');
assert.equal(capture.body.error.requestId, 'sandbox-request-1');
assert.equal(
  capture.body.error.message,
  'The requested sandbox endpoint is not implemented for this API.'
);

console.log('sandbox not found tests passed');
