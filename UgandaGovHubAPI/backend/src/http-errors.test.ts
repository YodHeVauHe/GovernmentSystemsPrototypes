import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { apiErrorHandler, jsonBodyErrorHandler } from './http-errors';

async function startApp() {
  const app = express();
  app.use(express.json({ limit: '12b' }));
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  app.get('/boom', () => {
    throw new Error('secret implementation detail');
  });
  app.use(jsonBodyErrorHandler);
  app.use(apiErrorHandler);

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function requestJson(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  const body = await response.json().catch(() => null);
  return { response, contentType, body };
}

async function run() {
  const { server, baseUrl } = await startApp();
  const originalConsoleError = console.error;
  const capturedErrors: string[] = [];
  console.error = (...args: unknown[]) => {
    capturedErrors.push(args.map(String).join(' '));
  };
  try {
    const malformed = await requestJson(baseUrl, '/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"broken"',
    });
    assert.equal(malformed.response.status, 400);
    assert.match(malformed.contentType, /application\/json/);
    assert.equal(malformed.body.code, 'INVALID_JSON');
    assert.equal(JSON.stringify(malformed.body).includes('SyntaxError'), false);

    const tooLarge = await requestJson(baseUrl, '/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: '01234567890123456789' }),
    });
    assert.equal(tooLarge.response.status, 413);
    assert.equal(tooLarge.body.code, 'JSON_BODY_TOO_LARGE');

    const unhandled = await requestJson(baseUrl, '/boom');
    assert.equal(unhandled.response.status, 500);
    assert.equal(unhandled.body.code, 'INTERNAL_ERROR');
    assert.equal(JSON.stringify(unhandled.body).includes('secret implementation detail'), false);
    assert.equal(capturedErrors.some(message => message.includes('secret implementation detail')), false);
  } finally {
    console.error = originalConsoleError;
    await close(server);
  }
}

run().then(() => {
  console.log('http error boundary tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
