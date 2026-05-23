import assert from 'assert/strict';
import express from 'express';
import { createServer, type Server } from 'http';
import Database from 'better-sqlite3';
import { ensureAuthSchema, ensureDefaultAdmin, requireAuth } from './auth';
import { authRouter, adminUsersRouter } from './routes/auth';
import { ensureAccountVerificationSchema } from './account-verification';

async function startApp() {
  const db = new Database(':memory:');
  ensureAuthSchema(db);
  process.env.GOVHUB_ADMIN_EMAIL = 'admin@ict.go.ug';
  process.env.GOVHUB_ADMIN_PASSWORD = 'AdminPass123!';
  ensureDefaultAdmin(db);
  ensureAccountVerificationSchema(db);

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter(db));
  app.use('/api/admin/users', adminUsersRouter(db));
  app.get('/protected', requireAuth(db, ['developer']), (_req, res) => {
    res.json({ ok: true });
  });

  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  return { db, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json();
  return { response, body };
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function run() {
  const { server, baseUrl } = await startApp();

  try {
    const signup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Jane Developer',
        email: 'Jane@Example.go.ug',
        password: 'StrongPass123!',
        account_type: 'government',
        requested_role: 'developer',
        requested_mda_id: 'mda-06',
        requested_organization: 'Ministry of Health',
        requested_purpose: 'Build a health service integration',
      }),
    });
    assert.equal(signup.response.status, 201);
    assert.equal(signup.body.user.email, 'jane@example.go.ug');
    assert.equal(signup.body.user.status, 'PENDING_REVIEW');
    assert.equal(signup.body.token, undefined);

    const publicDeveloperSignup = await request(baseUrl, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        full_name: 'Sam Civic',
        email: 'sam@example.com',
        password: 'StrongPass123!',
        account_type: 'public_developer',
        requested_role: 'developer',
        requested_mda_id: null,
        requested_organization: 'Independent Civic Developer',
        requested_purpose: 'Build a public-facing service using approved APIs',
      }),
    });
    assert.equal(publicDeveloperSignup.response.status, 201);
    assert.equal(publicDeveloperSignup.body.user.requested_mda_id, null);

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.go.ug', password: 'StrongPass123!' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.status, 'PENDING_REVIEW');
    assert.equal(typeof login.body.token, 'string');

    const me = await request(baseUrl, '/api/auth/me', {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(me.response.status, 200);
    assert.equal(me.body.user.email, 'jane@example.go.ug');

    const blocked = await request(baseUrl, '/protected', {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.body.code, 'ACCOUNT_NOT_APPROVED');

    const adminLogin = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@ict.go.ug', password: 'AdminPass123!' }),
    });
    assert.equal(adminLogin.response.status, 200);

    const users = await request(baseUrl, '/api/admin/users?status=PENDING_REVIEW', {
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
    });
    assert.equal(users.response.status, 200);
    assert.equal(users.body.users.length, 2);

    const publicDeveloperApproval = await request(baseUrl, `/api/admin/users/${publicDeveloperSignup.body.user.id}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
      body: JSON.stringify({ role: 'developer', mda_id: null }),
    });
    assert.equal(publicDeveloperApproval.response.status, 200);
    assert.equal(publicDeveloperApproval.body.user.status, 'APPROVED');
    assert.equal(publicDeveloperApproval.body.user.role, 'developer');
    assert.equal(publicDeveloperApproval.body.user.mda_id, null);

    const approval = await request(baseUrl, `/api/admin/users/${signup.body.user.id}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
      body: JSON.stringify({ role: 'developer', mda_id: 'mda-06' }),
    });
    assert.equal(approval.response.status, 200);
    assert.equal(approval.body.user.status, 'APPROVED');
    assert.equal(approval.body.user.role, 'developer');

    const allowed = await request(baseUrl, '/protected', {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.body.ok, true);
  } finally {
    await close(server);
  }
}

run().then(() => {
  console.log('auth route tests passed');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
