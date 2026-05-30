import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { businessRouter } from './routes/business';
import { compositeRouter } from './routes/composite';
import { drivingPermitRouter } from './routes/driving-permit';
import { identityRouter } from './routes/identity';
import { taxRouter } from './routes/tax';

async function request(baseUrl: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const responseBody = await response.json().catch(() => ({}));
  return { response, body: responseBody };
}

async function startApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/identity', identityRouter);
  app.use('/api/v1/tax', taxRouter);
  app.use('/api/v1/business', businessRouter);
  app.use('/api/v1/transport/driving-permit', drivingPermitRouter);
  app.use('/api/v1/service-uganda', compositeRouter);

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function main() {
  const app = await startApp();

  try {
    const malformedNinStatus = await request(app.baseUrl, '/api/v1/identity/status', {
      nin: { value: 'CM99021234567X' },
    });
    assert.equal(malformedNinStatus.response.status, 400);
    assert.equal(malformedNinStatus.body.error.code, 'INVALID_NIN');

    const malformedTinStatus = await request(app.baseUrl, '/api/v1/tax/tin-status', {
      tin: ['1000123456'],
    });
    assert.equal(malformedTinStatus.response.status, 400);
    assert.equal(malformedTinStatus.body.error.code, 'INVALID_TIN');

    const malformedBeneficialOwner = await request(app.baseUrl, '/api/v1/business/beneficial-ownership/verify', {
      brn: 'BRN12345',
      nin: ['CM99021234567X'],
    });
    assert.equal(malformedBeneficialOwner.response.status, 400);
    assert.equal(malformedBeneficialOwner.body.error.code, 'INVALID_NIN');

    const malformedPermitVerification = await request(app.baseUrl, '/api/v1/transport/driving-permit/verify', {
      permit_number: ['WP30219'],
    });
    assert.equal(malformedPermitVerification.response.status, 400);
    assert.equal(malformedPermitVerification.body.error.code, 'INVALID_PERMIT_NUMBER');

    const malformedCompositePermit = await request(app.baseUrl, '/api/v1/service-uganda/eligibility-check', {
      nin: 'CM99021234567X',
      tin: '1000123456',
      permit_number: { value: 'WP30219' },
    });
    assert.equal(malformedCompositePermit.response.status, 400);
    assert.equal(malformedCompositePermit.body.error.code, 'INVALID_PERMIT_NUMBER');
  } finally {
    await close(app.server);
  }
}

main().then(() => {
  console.log('sandbox route validation tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
