import type { AuthUser } from './auth';
import type { DbClient } from './db';
import { exec, hasColumn, many, one } from './db';

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

export async function ensureDocsSchema(db: DbClient) {
  if (!await hasColumn(db, 'apis', 'docs_visibility')) {
    await exec(db, 'ALTER TABLE apis ADD COLUMN docs_visibility TEXT');
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

async function hasApprovedConsumerAccess(db: DbClient, user: DocsAccessUser, apiId: string) {
  const now = new Date().toISOString();
  // Use two separate parameterised queries — no dynamic column name interpolation.
  if (user.mda_id) {
    return Boolean(
      await one(db, `
        SELECT id FROM access_requests
        WHERE consumer_mda_id = $1
          AND api_id = $2
          AND status = 'APPROVED'
          AND (api_key_hash IS NOT NULL OR api_key IS NOT NULL)
          AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
          AND (api_key_expires_at IS NULL OR api_key_expires_at > $3)
        LIMIT 1
      `, [user.mda_id, apiId, now])
    );
  }
  return Boolean(
    await one(db, `
      SELECT id FROM access_requests
      WHERE consumer_user_id = $1
        AND api_id = $2
        AND status = 'APPROVED'
        AND (api_key_hash IS NOT NULL OR api_key IS NOT NULL)
        AND COALESCE(api_key_status, 'ACTIVE') = 'ACTIVE'
        AND (api_key_expires_at IS NULL OR api_key_expires_at > $3)
      LIMIT 1
    `, [user.id, apiId, now])
  );
}

export async function canViewApiDocs(db: DbClient, user: DocsAccessUser | null | undefined, apiId: string): Promise<DocsDecision> {
  const api = await one<ApiVisibilityRow>(db, `
    SELECT id, owning_mda_id, docs_visibility, security_classification
    FROM apis
    WHERE id = $1
  `, [apiId]);

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
  if (user.role === 'developer' && await hasApprovedConsumerAccess(db, user, apiId)) return { allowed: true, visibility };

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

export async function canDownloadOpenApiAsset(db: DbClient, user: DocsAccessUser | null | undefined, assetPath: string): Promise<DocsDecision> {
  const openapiPath = normalizedOpenApiPath(assetPath);
  if (!openapiPath) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }

  let api: { id: string } | undefined = await one<{ id: string }>(db, 'SELECT id FROM apis WHERE openapi_spec_path = $1', [openapiPath]);
  if (!api) {
    try {
      api = await one<{ id: string }>(db, 'SELECT api_id as id FROM api_versions WHERE openapi_spec_path = $1', [openapiPath]);
    } catch {
      api = undefined as { id: string } | undefined;
    }
  }
  if (!api) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }
  return canViewApiDocs(db, user, api.id);
}

export type DocsApiListItem = ApiVisibilityRow & Record<string, unknown> & { docs_visibility: DocsVisibility };

export async function listVisibleDocsApis(db: DbClient, user: DocsAccessUser | null | undefined): Promise<DocsApiListItem[]> {
  // Resolve effective visibility in SQL to avoid N+1 queries.
  // The rule mirrors resolveDocsVisibility():
  //   explicit docs_visibility wins; else derive from security_classification.
  const allApis = await many<ApiVisibilityRow & Record<string, unknown> & { effective_visibility: DocsVisibility }>(db, `
    SELECT
      id, name, owning_mda_id, sector, description, lifecycle_status,
      sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level,
      contact_office, security_classification, docs_visibility,
      CASE
        WHEN LOWER(COALESCE(docs_visibility,'')) IN ('public','authenticated','restricted')
          THEN LOWER(docs_visibility)
        WHEN LOWER(COALESCE(security_classification,'')) = 'public'        THEN 'public'
        WHEN LOWER(COALESCE(security_classification,'')) IN ('restricted','private','secret') THEN 'restricted'
        ELSE 'authenticated'
      END AS effective_visibility
    FROM apis
    ORDER BY name ASC
  `);

  const visible: DocsApiListItem[] = [];
  for (const api of allApis) {
      const vis = api.effective_visibility;
      let allowed = false;

      // Public: always visible
      if (vis === 'public') allowed = true;

      // Non-public requires authentication
      if (!allowed && user && user.status === 'APPROVED') {
        // Authenticated: any approved user
        if (vis === 'authenticated') allowed = true;

        // Restricted: admin, reviewer, owning api_owner, or developer with approved access
        if (vis === 'restricted') {
          if (user.role === 'admin' || user.role === 'reviewer') allowed = true;
          if (user.role === 'api_owner' && user.mda_id && user.mda_id === api.owning_mda_id) allowed = true;
          if (user.role === 'developer') allowed = await hasApprovedConsumerAccess(db, user, String(api.id));
        }
      }

      if (allowed) {
        visible.push({
          ...api,
          docs_visibility: resolveDocsVisibility(api),
        });
      }
    }
  return visible;
}
