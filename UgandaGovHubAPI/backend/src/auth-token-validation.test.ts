import assert from 'assert/strict';
import { getBearerToken, SESSION_COOKIE_NAME } from './auth';

function requestWithHeaders(headers: Record<string, string>) {
  return { headers } as any;
}

const oversizedToken = `ghb_${'a'.repeat(4096)}`;

assert.equal(
  getBearerToken(requestWithHeaders({ authorization: `Bearer ${oversizedToken}` })),
  null
);

assert.equal(
  getBearerToken(requestWithHeaders({ cookie: `${SESSION_COOKIE_NAME}=${oversizedToken}` })),
  null
);

assert.equal(
  getBearerToken(requestWithHeaders({ authorization: 'Bearer session-token' })),
  'session-token'
);

assert.equal(
  getBearerToken(requestWithHeaders({ cookie: `${SESSION_COOKIE_NAME}=session-token` })),
  'session-token'
);

console.log('auth token validation tests passed');
