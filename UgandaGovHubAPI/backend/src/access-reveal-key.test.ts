import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import { SESSION_COOKIE_NAME } from './auth';
import type { DbClient } from './db';
import { accessRouter } from './routes/access';

const approvedDeveloper = {
  id: 'usr-reveal-key',
  full_name: 'Reveal Key Developer',
  email: 'reveal-key@example.go.ug',
  password_hash: 'unused',
  account_type: 'government_employee',
  requested_role: 'developer',
  requested_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  requested_organization: 'Ministry of Health',
  requested_purpose: 'Regression test',
  status: 'APPROVED',
  role: 'developer',
  mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  mfa_secret_encrypted: null,
  mfa_enabled_at: null,
  created_at: '2026-05-22T10:00:00.000Z',
  updated_at: '2026-05-22T10:00:00.000Z',
};

function createRevokedRevealDb() {
  let revealSql = '';
  let auditWrites = 0;

  const db: DbClient = {
    async query(sql) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [approvedDeveloper as any], rowCount: 1 };
      }

      if (/WITH claimed AS/i.test(sql)) {
        revealSql = sql;
        if (/r\.api_key_revoked_at IS NULL/i.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [{
            id: 'req-revoked-at-reveal',
            api_key: 'ghk_revoked_reveal_secret',
            api_key_preview: 'ghk_revo...cret',
            api_key_expires_at: '2026-12-01T00:00:00.000Z',
            api_id: 'api-nira-01',
            consumer_mda_id: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543',
            consumer_user_id: 'usr-reveal-key',
          }],
          rowCount: 1,
        };
      }

      if (/information_schema\.columns/i.test(sql)) {
        return { rows: [{ exists: true } as any], rowCount: 1 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in reveal key regression test: ${sql}`);
    },
  };

  return {
    db,
    revealSql: () => revealSql,
    auditWrites: () => auditWrites,
  };
}

function createSameMdaPeerRevealDb() {
  let revealSql = '';
  let auditWrites = 0;

  const db: DbClient = {
    async query(sql) {
      if (/FROM sessions s\s+JOIN users u/i.test(sql)) {
        return { rows: [approvedDeveloper as any], rowCount: 1 };
      }

      if (/WITH claimed AS/i.test(sql)) {
        revealSql = sql;
        if (/r\.consumer_user_id\s*=\s*\$2/i.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [{
            id: 'req-same-mda-peer',
            api_key: 'ghk_peer_should_not_claim',
            api_key_preview: 'ghk_peer...laim',
            api_key_expires_at: '2026-12-01T00:00:00.000Z',
            api_id: 'api-nira-01',
            consumer_mda_id: approvedDeveloper.mda_id,
            consumer_user_id: 'usr-original-requester',
          }],
          rowCount: 1,
        };
      }

      if (/information_schema\.columns/i.test(sql)) {
        return { rows: [{ exists: true } as any], rowCount: 1 };
      }

      if (/INSERT INTO audit_logs/i.test(sql)) {
        auditWrites += 1;
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unexpected query in same-MDA peer reveal regression test: ${sql}`);
    },
  };

  return {
    db,
    revealSql: () => revealSql,
    auditWrites: () => auditWrites,
  };
}

async function startApp(db: DbClient) {
  const app = express();
  app.use(express.json());
  app.use('/api/access', accessRouter(db));

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
  const fake = createRevokedRevealDb();
  const { server, baseUrl } = await startApp(fake.db);

  try {
    const response = await fetch(`${baseUrl}/api/access/req-revoked-at-reveal/reveal-key`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=session-token`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.code, 'ONE_TIME_KEY_UNAVAILABLE');
    assert.match(fake.revealSql(), /r\.api_key_revoked_at IS NULL/);
    assert.match(fake.revealSql(), /target\.api_key_revoked_at IS NULL/);
    assert.equal(fake.auditWrites(), 0);
  } finally {
    await close(server);
  }

  const sameMdaPeer = createSameMdaPeerRevealDb();
  const peerApp = await startApp(sameMdaPeer.db);
  try {
    const response = await fetch(`${peerApp.baseUrl}/api/access/req-same-mda-peer/reveal-key`, {
      method: 'POST',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=session-token`,
      },
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.code, 'ONE_TIME_KEY_UNAVAILABLE');
    assert.match(sameMdaPeer.revealSql(), /r\.consumer_user_id\s*=\s*\$2/);
    assert.equal(sameMdaPeer.auditWrites(), 0);
  } finally {
    await close(peerApp.server);
  }
}

main().then(() => {
  console.log('access reveal key lifecycle tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
