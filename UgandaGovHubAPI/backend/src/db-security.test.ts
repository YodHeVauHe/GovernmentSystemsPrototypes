import assert from 'assert';

const dbModule = require('./db') as {
  resolveDatabaseSslConfig?: (env: NodeJS.ProcessEnv) => false | { rejectUnauthorized: boolean };
};

assert.equal(typeof dbModule.resolveDatabaseSslConfig, 'function');

assert.deepStrictEqual(
  dbModule.resolveDatabaseSslConfig!({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
  { rejectUnauthorized: true }
);

assert.equal(
  dbModule.resolveDatabaseSslConfig!({ DATABASE_SSL: 'false' } as NodeJS.ProcessEnv),
  false
);

assert.deepStrictEqual(
  dbModule.resolveDatabaseSslConfig!({ DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' } as NodeJS.ProcessEnv),
  { rejectUnauthorized: false }
);
