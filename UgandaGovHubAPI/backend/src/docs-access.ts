import type { AuthUser } from './auth';
import type { DbClient } from './db';
import { exec, hasColumn, many, one } from './db';
import { getSpecByPath } from './openapi-store';

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
          AND api_key_revoked_at IS NULL
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
        AND api_key_revoked_at IS NULL
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

export async function canDownloadOpenApiAsset(db: DbClient, user: DocsAccessUser | null | undefined, assetPath: string): Promise<DocsDecision> {
  const spec = await getSpecByPath(db, assetPath);
  if (!spec) {
    return { allowed: false, code: 'NOT_FOUND', message: 'API documentation was not found.' };
  }
  return canViewApiDocs(db, user, spec.api_id);
}

export type DocsApiListItem = ApiVisibilityRow & Record<string, unknown> & { docs_visibility: DocsVisibility };

const DOCS_API_LIST_DEFAULT_LIMIT = 100;
const DOCS_API_LIST_MAX_LIMIT = 100;
const DOCS_API_LIST_MAX_OFFSET = 10000;

function boundedPositiveInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer < 1) return fallback;
  return Math.min(integer, max);
}

function boundedNonNegativeInteger(value: number, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(value);
  if (integer < 0) return fallback;
  return Math.min(integer, max);
}

function visibleDocsWhereClause(user: DocsAccessUser | null | undefined) {
  if (!user || user.status !== 'APPROVED') {
    return {
      whereClause: "WHERE effective_visibility = 'public'",
      params: [] as unknown[],
    };
  }

  if (user.role === 'admin' || user.role === 'reviewer') {
    return { whereClause: '', params: [] as unknown[] };
  }

  if (user.role === 'api_owner' && user.mda_id) {
    return {
      whereClause: "WHERE effective_visibility IN ('public', 'authenticated') OR (effective_visibility = 'restricted' AND owning_mda_id = $1)",
      params: [user.mda_id] as unknown[],
    };
  }

  if (user.role === 'developer') {
    const now = new Date().toISOString();
    if (user.mda_id) {
      return {
        whereClause: `
          WHERE effective_visibility IN ('public', 'authenticated')
             OR (
               effective_visibility = 'restricted'
               AND EXISTS (
                 SELECT 1
                 FROM access_requests access
                 WHERE access.consumer_mda_id = $1
                   AND access.api_id = visible_apis.id
                   AND access.status = 'APPROVED'
                   AND (access.api_key_hash IS NOT NULL OR access.api_key IS NOT NULL)
                   AND COALESCE(access.api_key_status, 'ACTIVE') = 'ACTIVE'
                   AND access.api_key_revoked_at IS NULL
                   AND (access.api_key_expires_at IS NULL OR access.api_key_expires_at > $2)
               )
             )
        `,
        params: [user.mda_id, now] as unknown[],
      };
    }
    return {
      whereClause: `
        WHERE effective_visibility IN ('public', 'authenticated')
           OR (
             effective_visibility = 'restricted'
             AND EXISTS (
               SELECT 1
               FROM access_requests access
               WHERE access.consumer_user_id = $1
                 AND access.api_id = visible_apis.id
                 AND access.status = 'APPROVED'
                 AND (access.api_key_hash IS NOT NULL OR access.api_key IS NOT NULL)
                 AND COALESCE(access.api_key_status, 'ACTIVE') = 'ACTIVE'
                 AND access.api_key_revoked_at IS NULL
                 AND (access.api_key_expires_at IS NULL OR access.api_key_expires_at > $2)
             )
           )
      `,
      params: [user.id, now] as unknown[],
    };
  }

  return {
    whereClause: "WHERE effective_visibility IN ('public', 'authenticated')",
    params: [] as unknown[],
  };
}

export async function listVisibleDocsApis(
  db: DbClient,
  user: DocsAccessUser | null | undefined,
  limit = DOCS_API_LIST_DEFAULT_LIMIT,
  offset = 0,
): Promise<DocsApiListItem[]> {
  // Resolve effective visibility in SQL to avoid N+1 queries.
  // The rule mirrors resolveDocsVisibility():
  //   explicit docs_visibility wins; else derive from security_classification.
  const { whereClause, params } = visibleDocsWhereClause(user);
  const safeLimit = boundedPositiveInteger(limit, DOCS_API_LIST_DEFAULT_LIMIT, DOCS_API_LIST_MAX_LIMIT);
  const safeOffset = boundedNonNegativeInteger(offset, 0, DOCS_API_LIST_MAX_OFFSET);

  const allApis = await many<ApiVisibilityRow & Record<string, unknown> & { effective_visibility: DocsVisibility }>(db, `
    SELECT *
    FROM (
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
    ) visible_apis
    ${whereClause}
    ORDER BY name ASC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, safeLimit, safeOffset]);

  return allApis.map(api => ({
    ...api,
    docs_visibility: resolveDocsVisibility(api),
  }));
}
