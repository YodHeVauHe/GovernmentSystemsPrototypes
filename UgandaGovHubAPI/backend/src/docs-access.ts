import type Database from 'better-sqlite3';
import type { AuthUser } from './auth';

export type DocsVisibility = 'public' | 'authenticated' | 'restricted';

export type DocsAccessUser = Pick<AuthUser, 'id' | 'status' | 'role' | 'mda_id'>;

type ApiVisibilityRow = {
  id: string;
  owning_mda_id?: string | null;
  docs_visibility?: string | null;
  security_classification?: string | null;
};

export type DocsDecision =
  | { allowed: true; visibility: DocsVisibility }
  | { allowed: false; code: 'NOT_FOUND' | 'UNAUTHENTICATED' | 'ACCOUNT_NOT_APPROVED' | 'FORBIDDEN'; message: string; visibility?: DocsVisibility };

export function ensureDocsSchema(db: Database.Database) {
  const columns = db.prepare('PRAGMA table_info(apis)').all() as Array<{ name: string }>;
  const names = new Set(columns.map(column => column.name));
  if (!names.has('docs_visibility')) {
    db.exec("ALTER TABLE apis ADD COLUMN docs_visibility TEXT");
  }
}

export function resolveDocsVisibility(api: Pick<ApiVisibilityRow, 'docs_visibility' | 'security_classification'>): DocsVisibility {
  const explicit = String(api.docs_visibility || '').toLowerCase();
  if (explicit === 'public' || explicit === 'authenticated' || explicit === 'restricted') {
    return explicit;
  }

  const classification = String(api.security_classification || '').toLowerCase();
  if (classification === 'public') return 'public';
  if (classification === 'restricted' || classification === 'private' || classification === 'secret') return 'restricted';
  return 'authenticated';
}

function hasApprovedConsumerAccess(db: Database.Database, user: DocsAccessUser, apiId: string) {
  const consumerColumn = user.mda_id ? 'consumer_mda_id' : 'consumer_user_id';
  const consumerId = user.mda_id || user.id;
  const record = db.prepare(`
    SELECT id
    FROM access_requests
    WHERE api_id = ?
      AND ${consumerColumn} = ?
      AND status = 'APPROVED'
      AND (api_key_hash IS NOT NULL OR api_key IS NOT NULL)
      AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
      AND (api_key_expires_at IS NULL OR api_key_expires_at > ?)
    LIMIT 1
  `).get(apiId, consumerId, new Date().toISOString());
  return Boolean(record);
}

export function canViewApiDocs(db: Database.Database, user: DocsAccessUser | null | undefined, apiId: string): DocsDecision {
  const api = db.prepare(`
    SELECT id, owning_mda_id, docs_visibility, security_classification
    FROM apis
    WHERE id = ?
  `).get(apiId) as ApiVisibilityRow | undefined;

  if (!api) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }

  const visibility = resolveDocsVisibility(api);
  if (visibility === 'public') return { allowed: true, visibility };

  if (!user) {
    return { allowed: false, code: 'UNAUTHENTICATED', message: 'Sign in to view this API documentation.', visibility };
  }
  if (user.status !== 'APPROVED') {
    return {
      allowed: false,
      code: 'ACCOUNT_NOT_APPROVED',
      message: 'Your account must be approved before viewing this API documentation.',
      visibility,
    };
  }
  if (visibility === 'authenticated') return { allowed: true, visibility };

  if (user.role === 'admin' || user.role === 'reviewer') return { allowed: true, visibility };
  if (user.role === 'api_owner' && user.mda_id && user.mda_id === api.owning_mda_id) return { allowed: true, visibility };
  if (user.role === 'developer' && hasApprovedConsumerAccess(db, user, apiId)) return { allowed: true, visibility };

  return {
    allowed: false,
    code: 'FORBIDDEN',
    message: 'This API documentation is restricted to approved access groups.',
    visibility,
  };
}

function normalizedOpenApiPath(assetPath: string) {
  const normalized = assetPath.startsWith('/openapi/') ? assetPath : `/openapi/${assetPath.replace(/^\/+/, '')}`;
  if (!normalized.startsWith('/openapi/') || normalized.includes('..')) return null;
  return normalized;
}

export function canDownloadOpenApiAsset(db: Database.Database, user: DocsAccessUser | null | undefined, assetPath: string): DocsDecision {
  const openapiPath = normalizedOpenApiPath(assetPath);
  if (!openapiPath) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }

  let api = db.prepare('SELECT id FROM apis WHERE openapi_spec_path = ?').get(openapiPath) as { id: string } | undefined;
  if (!api) {
    try {
      api = db.prepare('SELECT api_id as id FROM api_versions WHERE openapi_spec_path = ?').get(openapiPath) as { id: string } | undefined;
    } catch {
      api = undefined;
    }
  }
  if (!api) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }
  return canViewApiDocs(db, user, api.id);
}

export type DocsApiListItem = ApiVisibilityRow & Record<string, unknown> & { docs_visibility: DocsVisibility };

export function listVisibleDocsApis(db: Database.Database, user: DocsAccessUser | null | undefined): DocsApiListItem[] {
  const apis = db.prepare(`
    SELECT
      id, name, owning_mda_id, sector, description, lifecycle_status,
      sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level,
      contact_office, security_classification, docs_visibility
    FROM apis
    ORDER BY name ASC
  `).all() as Array<ApiVisibilityRow & Record<string, unknown>>;

  return apis
    .filter(api => canViewApiDocs(db, user, String(api.id)).allowed)
    .map(api => ({
      ...api,
      docs_visibility: resolveDocsVisibility(api),
    }));
}
