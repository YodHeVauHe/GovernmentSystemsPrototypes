import assert from 'assert';

const apiCredentials = await import('../lib/api-credentials').catch(() => null);

const locationLike = {
  origin: 'https://portal.govhub.example',
};

assert.equal(
  apiCredentials?.isCredentialedApiRequest(
    '/api/auth/me',
    'https://api.govhub.example',
    locationLike,
  ),
  true,
  'Relative /api requests should send GovHub API credentials.',
);

assert.equal(
  apiCredentials?.isCredentialedApiRequest(
    'https://api.govhub.example/api/auth/me',
    'https://api.govhub.example',
    locationLike,
  ),
  true,
  'The configured API origin should send GovHub API credentials.',
);

assert.equal(
  apiCredentials?.isCredentialedApiRequest(
    'https://api.govhub.example/backend/api/auth/me',
    'https://api.govhub.example/backend',
    locationLike,
  ),
  true,
  'The configured API base path should send GovHub API credentials.',
);

assert.equal(
  apiCredentials?.isCredentialedApiRequest(
    'https://api.govhub.example.evil.test/api/auth/me',
    'https://api.govhub.example',
    locationLike,
  ),
  false,
  'Lookalike API hostnames must not receive credentialed fetches.',
);

assert.equal(
  apiCredentials?.isCredentialedApiRequest(
    'https://api.govhub.example/backend.evil/api/auth/me',
    'https://api.govhub.example/backend',
    locationLike,
  ),
  false,
  'Lookalike API base paths must not receive credentialed fetches.',
);
