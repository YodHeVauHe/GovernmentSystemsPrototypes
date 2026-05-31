import assert from 'assert';
import { adminUsersRouter, authRouter } from './routes/auth';
import type { AuthUser, UserRole } from './auth';
import type { Db, DbClient } from './db';

type MockRequest = {
  params: Record<string, string>;
  query?: Record<string, string>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
  ip?: string;
  user?: AuthUser;
};

type MockResponse = {
  statusCode: number;
  body?: Record<string, unknown>;
  ended: boolean;
  status: (statusCode: number) => MockResponse;
  json: (body: Record<string, unknown>) => MockResponse;
};

function createMockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    ended: false,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: Record<string, unknown>) {
      this.body = body;
      this.ended = true;
      return this;
    },
  };
  return response;
}

async function invokeMiddleware(
  handle: (req: MockRequest, res: MockResponse, next: (error?: unknown) => void) => unknown,
  req: MockRequest,
  res: MockResponse,
) {
  await new Promise<void>((resolve, reject) => {
    let nextCalled = false;
    const next = (error?: unknown) => {
      nextCalled = true;
      if (error) reject(error);
      else resolve();
    };

    Promise.resolve(handle(req, res, next)).then(() => {
      if (res.ended || !nextCalled) resolve();
    }, reject);
  });
}

function baseUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 'user-default',
    full_name: 'Default User',
    email: 'default@example.go.ug',
    password_hash: '',
    account_type: 'public_developer',
    requested_role: 'developer',
    requested_mda_id: null,
    requested_organization: 'Default Organization',
    requested_purpose: 'Use APIs',
    status: 'PENDING_REVIEW',
    role: null,
    mda_id: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    mfa_secret_encrypted: null,
    mfa_enabled_at: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

const adminUser = baseUser({
  id: 'admin-user',
  full_name: 'Platform Admin',
  email: 'admin@example.go.ug',
  account_type: 'government_employee',
  requested_role: 'admin',
  status: 'APPROVED',
  role: 'admin',
  mda_id: 'mda-admin',
});

const tamperedReviewerApplicant = baseUser({
  id: 'applicant-user',
  requested_role: 'reviewer',
});

const publicDeveloperProfile: Record<string, string | null> = {
  user_id: 'applicant-user',
  verification_status: 'submitted_for_review',
  account_category: 'public_developer',
  nin: 'CM99021234567X',
  national_id_number: 'NID123456',
  contact_phone: '+256700000000',
  address: 'Kampala',
  organization_name: 'Public Developer Project',
  organization_type: null,
  ursb_number: null,
  brn: null,
  tin: null,
  staff_id: null,
  department: null,
  job_title: null,
  supervisor_name: null,
  supervisor_email: null,
  review_notes: null,
  submitted_at: new Date(0).toISOString(),
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const governmentEmployeeProfile = {
  ...publicDeveloperProfile,
  account_category: 'government_employee',
  staff_id: 'STAFF-001',
  department: 'Digital Services',
  job_title: 'Compliance Officer',
  supervisor_name: 'Approving Supervisor',
  supervisor_email: 'supervisor@example.go.ug',
};

class AccountRoleSecurityDb implements Db {
  insertedSignupUser: AuthUser | null = null;
  applicantProfile: Record<string, string | null> = publicDeveloperProfile;

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    return this.querySql<T>(sql, params);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    const client: DbClient = {
      query: async <R = any>(sql: string, params: unknown[] = []) => this.querySql<R>(sql, params),
    };
    return callback(client);
  }

  private userById(id: unknown) {
    if (id === adminUser.id) return adminUser;
    if (id === tamperedReviewerApplicant.id) return tamperedReviewerApplicant;
    if (this.insertedSignupUser && id === this.insertedSignupUser.id) return this.insertedSignupUser;
    return null;
  }

  private async querySql<T>(sql: string, params: unknown[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (normalizedSql.includes('FROM sessions s JOIN users u')) {
      return { rows: [adminUser as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE email = $1') {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql === 'SELECT * FROM users WHERE id = $1') {
      const user = this.userById(params[0]);
      return { rows: user ? [user as T] : [], rowCount: user ? 1 : 0 };
    }

    if (normalizedSql.includes('INSERT INTO users')) {
      this.insertedSignupUser = baseUser({
        id: String(params[0]),
        full_name: String(params[1]),
        email: String(params[2]),
        password_hash: String(params[3]),
        account_type: String(params[4]),
        requested_role: String(params[5]) as UserRole,
        requested_mda_id: params[6] ? String(params[6]) : null,
        requested_organization: String(params[7]),
        requested_purpose: String(params[8]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('INSERT INTO user_profiles')) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT COUNT(*) as count FROM users')) {
      return { rows: [{ count: '2' } as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT id FROM mdas WHERE id = $1') {
      return { rows: [{ id: params[0] } as T], rowCount: 1 };
    }

    if (normalizedSql === 'SELECT * FROM user_profiles WHERE user_id = $1') {
      return { rows: [this.applicantProfile as T], rowCount: 1 };
    }

    if (normalizedSql.includes('SELECT * FROM verification_documents')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.startsWith('LOCK TABLE users')) {
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.includes("UPDATE users SET status = 'APPROVED'")) {
      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.includes("UPDATE user_profiles SET verification_status = 'verified'")) {
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL in account role security test: ${normalizedSql}`);
  }
}

async function invokeRoute(router: any, routePath: string, method: string, req: MockRequest) {
  const res = createMockResponse();

  for (const layer of router.stack) {
    if (res.ended) break;
    if (!layer.route) {
      await invokeMiddleware(layer.handle, req, res);
      continue;
    }
    if (layer.route.path !== routePath || !layer.route.methods?.[method]) continue;
    for (const routeLayer of layer.route.stack) {
      await invokeMiddleware(routeLayer.handle, req, res);
      if (res.ended) break;
    }
  }

  return { status: res.statusCode, body: res.body || {} };
}

async function runAccountRoleSecurityTests() {
  const signupDb = new AccountRoleSecurityDb();
  const signupResponse = await invokeRoute(authRouter(signupDb), '/signup', 'post', {
    params: {},
    headers: {},
    ip: '127.0.0.1',
    body: {
      full_name: 'Tampered Reviewer',
      email: 'reviewer@example.go.ug',
      password: 'StrongPass1!',
      account_type: 'public_developer',
      requested_role: 'reviewer',
      requested_organization: 'Personal Project',
      requested_purpose: 'Try to access review workflows',
    },
  });
  assert.equal(signupResponse.status, 400);
  assert.match(String(signupResponse.body.error || ''), /requested_role/i);

  const approvalDb = new AccountRoleSecurityDb();
  const approvalResponse = await invokeRoute(adminUsersRouter(approvalDb), '/:id/approve', 'post', {
    params: { id: tamperedReviewerApplicant.id },
    headers: { authorization: 'Bearer admin-session' },
    body: {
      role: 'reviewer',
      mda_id: null,
    },
  });
  assert.equal(approvalResponse.status, 400);
  assert.equal(approvalResponse.body.code, 'ROLE_ACCOUNT_CATEGORY_MISMATCH');

  const governmentApprovalDb = new AccountRoleSecurityDb();
  governmentApprovalDb.applicantProfile = governmentEmployeeProfile;
  const governmentApprovalResponse = await invokeRoute(adminUsersRouter(governmentApprovalDb), '/:id/approve', 'post', {
    params: { id: tamperedReviewerApplicant.id },
    headers: { authorization: 'Bearer admin-session' },
    body: {
      role: 'reviewer',
      mda_id: null,
    },
  });
  assert.equal(governmentApprovalResponse.status, 400);
  assert.match(String(governmentApprovalResponse.body.error || ''), /mda_id is required/i);
}

runAccountRoleSecurityTests();
