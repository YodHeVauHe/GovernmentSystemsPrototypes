import { Router } from 'express';
import type { Db, DbClient } from '../db';
import { many, one, run } from '../db';
import { requireAuth, type AuthUser } from '../auth';
import { requireApiManager } from '../access-control';
import { generatePublicId } from '../ids';
import { getSpecSha, parseSpecMetadata, slugifyVersion } from '../versioning';
import { resolveCatalogSpecInput } from '../catalog-spec-input';
import { fetchSpecFromUrl } from '../catalog-spec-url';

function statusForDocsDecision(code: string) {
  if (code === 'UNAUTHENTICATED') return 401;
  if (code === 'NOT_FOUND') return 404;
  return 403;
}

function isOpenApiValidationError(err: any) {
  const message = String(err?.message || '');
  return err?.name === 'YAMLException'
    || message.startsWith('Invalid specification:')
    || message === 'Specification parsed to an invalid object.';
}

type OptionalVersionTextResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

const CATALOG_VERSION_LIST_DEFAULT_LIMIT = 100;
const CATALOG_VERSION_LIST_MAX_LIMIT = 100;
const CATALOG_VERSION_LIST_MAX_OFFSET = 10000;

function integerQueryParam(value: unknown, fallback: number) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function optionalVersionText(value: unknown, fieldName: string, maxLength: number): OptionalVersionTextResult {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, message: `${fieldName} must be a string.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, message: `${fieldName} must be ${maxLength} characters or fewer.` };
  }

  return { ok: true, value: trimmed };
}

function catalogParams(req: { params: unknown }) {
  return req.params as { id: string; version?: string };
}

function versionPromotionStaleError() {
  return Object.assign(new Error('The API version changed before promotion could complete.'), {
    code: 'VERSION_PROMOTION_STALE',
  });
}

function versionDeleteStaleError() {
  return Object.assign(new Error('The API version changed before deletion could complete.'), {
    code: 'VERSION_DELETE_STALE',
  });
}

function versionPublishStaleError() {
  return Object.assign(new Error('The API version changed before publishing could complete.'), {
    code: 'VERSION_PUBLISH_STALE',
  });
}

function isVersionPublishStaleError(err: any) {
  return err?.code === 'VERSION_PUBLISH_STALE'
    || err?.code === '23503'
    || err?.code === '23505';
}

async function ensureVersionMutationActorCurrent(
  db: DbClient,
  apiId: string,
  user: Pick<AuthUser, 'role' | 'mda_id'>,
  staleError: () => Error,
) {
  const api = await one(db, `
    SELECT id
    FROM apis
    WHERE id = $1
      AND ($2 = TRUE OR owning_mda_id = $3)
    FOR UPDATE
  `, [apiId, user.role === 'admin', user.mda_id]);
  if (!api) {
    throw staleError();
  }
}

export function catalogVersionsRouter(db: Db, canViewApiDocs: typeof import('../docs-access').canViewApiDocs) {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res) => {
    try {
      const apiId = String(catalogParams(req).id);
      const decision = await canViewApiDocs(db, req.user, apiId);
      if (decision.allowed === false) {
        return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
      }

      const requestedLimit = integerQueryParam(req.query.limit, CATALOG_VERSION_LIST_DEFAULT_LIMIT);
      const requestedOffset = integerQueryParam(req.query.offset, 0);
      const limit = boundedPositiveInteger(requestedLimit, CATALOG_VERSION_LIST_DEFAULT_LIMIT, CATALOG_VERSION_LIST_MAX_LIMIT);
      const offset = boundedNonNegativeInteger(requestedOffset, 0, CATALOG_VERSION_LIST_MAX_OFFSET);
      const current = await one(db, 'SELECT spec_sha FROM api_versions WHERE api_id = $1 AND is_current = TRUE', [apiId]) as any;
      const versions = await many(db, `
        SELECT
          id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
          openapi_version, status, is_current, notes, created_at
        FROM api_versions
        WHERE api_id = $1
        ORDER BY is_current DESC, created_at DESC
        LIMIT $2 OFFSET $3
      `, [apiId, limit, offset]) as any[];

      res.json(versions.map(version => ({
        ...version,
        is_current: Boolean(version.is_current),
        sync_status: current?.spec_sha === version.spec_sha ? 'current' : 'available',
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch API versions' });
    }
  });

  router.post('/', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(catalogParams(req).id)), async (req, res) => {
    const { status, notes, make_current } = req.body;
    const apiId = String(catalogParams(req).id);
    if (make_current !== undefined && make_current !== null && typeof make_current !== 'boolean') {
      return res.status(400).json({ error: 'make_current must be a boolean.' });
    }

    const statusInput = optionalVersionText(status, 'status', 100);
    if (!statusInput.ok) {
      return res.status(400).json({ error: statusInput.message });
    }
    const notesInput = optionalVersionText(notes, 'notes', 2000);
    if (!notesInput.ok) {
      return res.status(400).json({ error: notesInput.message });
    }

    try {
      const openapiSpec = await resolveCatalogSpecInput(req.body, fetchSpecFromUrl);
      const api = await one(db, 'SELECT id FROM apis WHERE id = $1', [apiId]) as any;
      if (!api) {
        return res.status(404).json({ error: 'API not found' });
      }

      const metadata = parseSpecMetadata(openapiSpec);
      const version = metadata.version;
      const versionId = `${apiId}-${slugifyVersion(version)}`;
      const existing = await one(db, 'SELECT id FROM api_versions WHERE api_id = $1 AND (version = $2 OR id = $3)', [apiId, version, versionId]);
      if (existing) {
        return res.status(409).json({ error: `Version ${version} already exists for this API.` });
      }

      const specFilename = `${versionId}.yaml`;
      const relativeSpecPath = `/openapi/${specFilename}`;
      const shouldMakeCurrent = make_current === true;
      const transaction = db.transaction(async client => {
        await ensureVersionMutationActorCurrent(client, apiId, req.user!, versionPublishStaleError);

        if (shouldMakeCurrent) {
          await run(client, 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1', [apiId]);
          const apiUpdate = await run(client, 'UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3', [relativeSpecPath, openapiSpec, apiId]);
          if (apiUpdate.changes !== 1) {
            throw versionPublishStaleError();
          }
        }

        const versionInsert = await run(client, `
          INSERT INTO api_versions (
            id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
            openapi_version, status, is_current, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING
        `, [
          versionId,
          apiId,
          version,
          relativeSpecPath,
          openapiSpec,
          getSpecSha(openapiSpec),
          metadata.endpointsCount,
          metadata.openapiVersion,
          statusInput.value || 'Published',
          shouldMakeCurrent,
          notesInput.value,
        ]);
        if (versionInsert.changes !== 1) {
          throw versionPublishStaleError();
        }

        await run(client, `
          INSERT INTO audit_logs (id, event_type, api_id, details)
          VALUES ($1, $2, $3, $4)
        `, [
          generatePublicId('audit'),
          'API_VERSION_PUBLISHED',
          apiId,
          JSON.stringify({ version, make_current: shouldMakeCurrent, endpoints_count: metadata.endpointsCount }),
        ]);
      });

      await transaction;
      res.status(201).json({ success: true, versionId, version, is_current: shouldMakeCurrent });
    } catch (err: any) {
      if (isVersionPublishStaleError(err)) {
        const staleError = versionPublishStaleError();
        return res.status(409).json({ error: staleError.message, code: staleError.code });
      }
      if (err?.code === 'SPEC_INPUT_REQUIRED' || err?.code === 'SPEC_URL_FETCH_FAILED') {
        return res.status(400).json({ error: err.message });
      }
      if (isOpenApiValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      console.error('[version publish]', err);
      res.status(500).json({ error: 'Failed to publish version. Please try again.' });
    }
  });

  router.post('/:version/current', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(catalogParams(req).id)), async (req, res) => {
    const { id: apiId, version: requestedVersion } = catalogParams(req);

    try {
      const version = await one(db, 'SELECT * FROM api_versions WHERE api_id = $1 AND version = $2', [apiId, requestedVersion]) as any;
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }

      const transaction = db.transaction(async client => {
        await ensureVersionMutationActorCurrent(client, apiId, req.user!, versionPromotionStaleError);

        await run(client, 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1', [apiId]);
        const promoteUpdate = await run(client, `
          UPDATE api_versions
          SET is_current = TRUE
          WHERE id = $1
            AND api_id = $2
        `, [version.id, apiId]);
        if (promoteUpdate.changes !== 1) {
          throw versionPromotionStaleError();
        }
        const apiUpdate = await run(client, 'UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3', [version.openapi_spec_path, version.openapi_spec_text, apiId]);
        if (apiUpdate.changes !== 1) {
          throw versionPromotionStaleError();
        }
        await run(client, `
          INSERT INTO audit_logs (id, event_type, api_id, details)
          VALUES ($1, $2, $3, $4)
        `, [generatePublicId('audit'), 'API_VERSION_PROMOTED', apiId, JSON.stringify({ version: requestedVersion })]);
      });

      await transaction;
      res.json({ success: true, version: requestedVersion });
    } catch (err: any) {
      if (err?.code === 'VERSION_PROMOTION_STALE') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      console.error('[version promote]', err);
      res.status(500).json({ error: 'Failed to promote version. Please try again.' });
    }
  });

  router.delete('/:version', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(catalogParams(req).id)), async (req, res) => {
    const { id: apiId, version: requestedVersion } = catalogParams(req);

    try {
      const version = await one(db, 'SELECT * FROM api_versions WHERE api_id = $1 AND version = $2', [apiId, requestedVersion]) as any;
      if (!version) {
        return res.status(404).json({ error: 'Version not found' });
      }
      if (version.is_current) {
        return res.status(409).json({ error: 'Cannot delete the current version. Promote another version first.' });
      }

      await db.transaction(async client => {
        await ensureVersionMutationActorCurrent(client, apiId, req.user!, versionDeleteStaleError);

        const deleteUpdate = await run(client, `
          DELETE FROM api_versions
          WHERE id = $1
            AND api_id = $2
            AND COALESCE(is_current, FALSE) = FALSE
        `, [version.id, apiId]);
        if (deleteUpdate.changes !== 1) {
          throw versionDeleteStaleError();
        }
        await run(client, `
          INSERT INTO audit_logs (id, event_type, api_id, details)
          VALUES ($1, $2, $3, $4)
        `, [generatePublicId('audit'), 'API_VERSION_DELETED', apiId, JSON.stringify({ version: requestedVersion })]);
      });

      res.json({ success: true, version: requestedVersion });
    } catch (err: any) {
      if (err?.code === 'VERSION_DELETE_STALE') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      console.error('[version delete]', err);
      res.status(500).json({ error: 'Failed to delete version. Please try again.' });
    }
  });

  return router;
}
