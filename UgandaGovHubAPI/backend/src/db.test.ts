import assert from 'node:assert/strict';
import { resolveDatabaseTimeoutConfig } from './db';

{
  const config = resolveDatabaseTimeoutConfig({});
  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.query_timeout, 10_000);
  assert.equal(config.statement_timeout, 10_000);
}

{
  const config = resolveDatabaseTimeoutConfig({
    DATABASE_CONNECTION_TIMEOUT_MS: '2500',
    DATABASE_QUERY_TIMEOUT_MS: '7000',
  });
  assert.equal(config.connectionTimeoutMillis, 2_500);
  assert.equal(config.query_timeout, 7_000);
  assert.equal(config.statement_timeout, 7_000);
}

{
  const config = resolveDatabaseTimeoutConfig({
    DATABASE_CONNECTION_TIMEOUT_MS: '0',
    DATABASE_QUERY_TIMEOUT_MS: 'invalid',
  });
  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.query_timeout, 10_000);
  assert.equal(config.statement_timeout, 10_000);
}

console.log('db timeout tests passed');
