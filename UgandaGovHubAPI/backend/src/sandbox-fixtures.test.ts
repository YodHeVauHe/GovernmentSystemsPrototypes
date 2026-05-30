import assert from 'assert';
import { findSandboxOpenApiResponse } from './sandbox-openapi-response';
import {
  isKnownSandboxBeneficialOwnerNin,
  isKnownSandboxBusinessRegistration,
  sandboxDrivingPermitStatus,
  sandboxIdentityCardStatus,
  sandboxIdentityVerificationStatus,
  sandboxTaxComplianceStatus,
} from './sandbox-fixtures';

assert.equal(sandboxDrivingPermitStatus('WP30219'), 'ACTIVE');
assert.equal(sandboxDrivingPermitStatus('WP30219susp'), 'SUSPENDED');
assert.equal(sandboxDrivingPermitStatus('WP30219exp'), 'EXPIRED');
assert.equal(sandboxDrivingPermitStatus('WP99999'), null);
assert.equal(sandboxDrivingPermitStatus('WP30219valid'), null);

assert.equal(sandboxIdentityVerificationStatus('CM99021234567X'), 'MATCH');
assert.equal(sandboxIdentityVerificationStatus('CM00000000000X'), 'NO_MATCH');
assert.equal(sandboxIdentityVerificationStatus('CM11111111111X'), null);

assert.equal(sandboxIdentityCardStatus('CM99021234567X'), 'ACTIVE');
assert.equal(sandboxIdentityCardStatus('CM99021234567E'), 'EXPIRED');
assert.equal(sandboxIdentityCardStatus('CM99021234567R'), 'REVOKED');
assert.equal(sandboxIdentityCardStatus('CM11111111111X'), null);

assert.equal(sandboxTaxComplianceStatus('1000123456'), 'COMPLIANT');
assert.equal(sandboxTaxComplianceStatus('9999999999'), 'NON_COMPLIANT');
assert.equal(sandboxTaxComplianceStatus('1234567890'), null);

assert.equal(isKnownSandboxBusinessRegistration('BRN12345'), true);
assert.equal(isKnownSandboxBusinessRegistration('BRN00000'), true);
assert.equal(isKnownSandboxBusinessRegistration('BRN99999'), false);

assert.equal(isKnownSandboxBeneficialOwnerNin('CM99021234567X'), true);
assert.equal(isKnownSandboxBeneficialOwnerNin('CM00000000000X'), true);
assert.equal(isKnownSandboxBeneficialOwnerNin('CM11111111111X'), false);

const fallbackSpec = {
  openapi: '3.0.3',
  servers: [{ url: 'https://ugandagovhubapi.vercel.app/api/v1/tax' }],
  paths: {
    '/vat-status/{tin}': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                example: {
                  tin: '1000123456',
                  vatRegistered: true,
                  correlationId: 'corr-ura-vat-0003',
                },
              },
            },
          },
        },
      },
    },
  },
};

assert.deepEqual(
  findSandboxOpenApiResponse(fallbackSpec, '/api/v1/tax/vat-status/1000123456', 'GET'),
  {
    kind: 'response',
    status: 200,
    body: {
      tin: '1000123456',
      vatRegistered: true,
      correlationId: 'corr-ura-vat-0003',
    },
  },
  'OpenAPI fallback should return 200 for direct sandbox API paths with known fixture values.',
);

assert.deepEqual(
  findSandboxOpenApiResponse(fallbackSpec, '/api/v1/sandbox/api-ura-13897843-012d-4951-8b06-374fff183c3e/vat-status/1000123456', 'GET'),
  {
    kind: 'response',
    status: 200,
    body: {
      tin: '1000123456',
      vatRegistered: true,
      correlationId: 'corr-ura-vat-0003',
    },
  },
  'OpenAPI fallback should return 200 for registered /sandbox/:apiId paths with known fixture values.',
);

assert.deepEqual(
  findSandboxOpenApiResponse(fallbackSpec, '/api/v1/tax/vat-status/junk', 'GET'),
  {
    kind: 'error',
    status: 404,
    code: 'TIN_NOT_FOUND',
    message: 'The provided TIN does not exist in the sandbox URA registry.',
  },
  'OpenAPI fallback should reject changed or junk path identifiers instead of returning a fake 200.',
);

const postFallbackSpec = {
  openapi: '3.0.3',
  servers: [{ url: 'https://ugandagovhubapi.vercel.app/api/v1/service-uganda' }],
  paths: {
    '/eligibility/check': {
      post: {
        requestBody: {
          content: {
            'application/json': {
              example: {
                nin: 'CM99021234567X',
                tin: '1000123456',
                brn: '80010001234567',
                permitNumber: 'DP-UG-2026-001245',
                serviceCode: 'BUSINESS_PSV_LICENCE',
              },
            },
          },
        },
        responses: {
          '200': {
            content: {
              'application/json': {
                example: {
                  overallDecision: 'ELIGIBLE',
                  correlationId: 'corr-sug-eligibility-0001',
                },
              },
            },
          },
        },
      },
    },
  },
};

assert.deepEqual(
  findSandboxOpenApiResponse(
    postFallbackSpec,
    '/api/v1/service-uganda/eligibility/check',
    'POST',
    {
      nin: 'CM99021234567X',
      tin: '1000123456',
      brn: '80010001234567',
      permitNumber: 'DP-UG-2026-001245',
      serviceCode: 'BUSINESS_PSV_LICENCE',
    },
  ),
  {
    kind: 'response',
    status: 200,
    body: {
      overallDecision: 'ELIGIBLE',
      correlationId: 'corr-sug-eligibility-0001',
    },
  },
  'OpenAPI fallback should return 200 for documented POST fixtures.',
);

assert.deepEqual(
  findSandboxOpenApiResponse(
    postFallbackSpec,
    '/api/v1/service-uganda/eligibility/check',
    'POST',
    {
      nin: 'junk',
      tin: '1000123456',
      brn: '80010001234567',
      permitNumber: 'DP-UG-2026-001245',
      serviceCode: 'BUSINESS_PSV_LICENCE',
    },
  ),
  {
    kind: 'error',
    status: 404,
    code: 'NIN_NOT_FOUND',
    message: 'The provided NIN does not exist in the sandbox NIRA registry.',
  },
  'OpenAPI fallback should reject changed or junk POST identifiers instead of returning a fake 200.',
);
