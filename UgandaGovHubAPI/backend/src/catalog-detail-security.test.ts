import assert from 'assert';
import { catalogRouter } from './routes/catalog';
import type { AuthUser } from './auth';
import type { Db, DbClient } from './db';

type MockRequest = {
  params: Record<string, string>;
  query?: Record<string, unknown>;
  body: Record<string, unknown>;
  headers: Record<string, string>;
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

async function invokeCatalogDetail(db: Db) {
  const router = catalogRouter(db);
  const req: MockRequest = {
    params: { id: 'api-public-1' },
    headers: {},
    body: {},
  };
  const res = createMockResponse();

  for (const layer of (router as any).stack) {
    if (res.ended) break;
    if (!layer.route) continue;
    if (layer.route.path !== '/:id' || !layer.route.methods?.get) continue;

    for (const routeLayer of layer.route.stack) {
      await invokeMiddleware(routeLayer.handle, req, res);
      if (res.ended) break;
    }
  }

  return { status: res.statusCode, body: res.body || {} };
}

class CatalogDetailSecurityDb implements Db {
  sawSelectStarCatalogDetail = false;

  async query<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();

    if (
      normalizedSql ===
      'SELECT id, owning_mda_id, docs_visibility, security_classification FROM apis WHERE id = $1'
    ) {
      return {
        rows: [{
          id: params[0],
          owning_mda_id: 'mda-public',
          docs_visibility: 'public',
          security_classification: 'public',
        } as T],
        rowCount: 1,
      };
    }

    if (normalizedSql === 'SELECT * FROM apis WHERE id = $1') {
      this.sawSelectStarCatalogDetail = true;
      return {
        rows: [{
          id: params[0],
          name: 'Public API',
          owning_mda_id: 'mda-public',
          sector: 'Public Services',
          description: 'A public API.',
          lifecycle_status: 'Production',
          sensitivity_level: 'Low',
          sandbox_available: true,
          openapi_spec_path: '/openapi/public-api.yaml',
          openapi_spec_text: 'openapi: 3.0.0\ninfo:\n  title: Public API\n  version: 1.0.0\n',
          internal_review_notes: 'internal-only note',
        } as T],
        rowCount: 1,
      };
    }

    if (
      normalizedSql.includes('SELECT id, name, owning_mda_id, sector, description, lifecycle_status,')
      && normalizedSql.includes('personal_data_categories, purpose_limitation, data_minimization_note, retention_class,')
      && normalizedSql.includes('FROM apis WHERE id = $1')
    ) {
      return {
        rows: [{
          id: params[0],
          name: 'Public API',
          owning_mda_id: 'mda-public',
          sector: 'Public Services',
          description: 'A public API.',
          lifecycle_status: 'Production',
          sensitivity_level: 'Low',
          sandbox_available: true,
          openapi_spec_path: '/openapi/public-api.yaml',
          required_approval_level: 'Automated',
          contact_office: 'API Office',
          technical_owner: 'API Team',
          personal_data_categories: 'None',
          purpose_limitation: 'Public lookup',
          data_minimization_note: 'Metadata only',
          retention_class: 'Public',
          statutory_basis: 'Open data mandate',
          security_classification: 'public',
          sla_target: '99.5%',
          compliance_status: 'Approved for Production',
          docs_visibility: 'public',
        } as T],
        rowCount: 1,
      };
    }

    throw new Error(`Unexpected SQL in catalog detail security test: ${normalizedSql}`);
  }

  async exec(_sql: string): Promise<void> {}

  async close(): Promise<void> {}

  async transaction<T>(_callback: (client: DbClient) => Promise<T>): Promise<T> {
    throw new Error('Catalog detail security test should not open a transaction.');
  }
}

async function runCatalogDetailSecurityTests() {
  const db = new CatalogDetailSecurityDb();
  const response = await invokeCatalogDetail(db);

  assert.equal(response.status, 200);
  assert.equal(db.sawSelectStarCatalogDetail, false, 'catalog detail must select an explicit public metadata field list');
  assert.equal(response.body.openapi_spec_text, undefined, 'catalog detail must not expose stored OpenAPI spec text');
  assert.equal(response.body.internal_review_notes, undefined, 'catalog detail must not expose unlisted internal catalog fields');
}

void runCatalogDetailSecurityTests().catch(error => {
  console.error(error);
  process.exit(1);
});
