import { Router } from 'express';
import type { Db } from '../db';
import { many, one, run } from '../db';
import { requireAuth } from '../auth';
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

function catalogParams(req: { params: unknown }) {
  return req.params as { id: string; version?: string };
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

      const current = await one(db, 'SELECT spec_sha FROM api_versions WHERE api_id = $1 AND is_current = TRUE', [apiId]) as any;
      const versions = await many(db, `
        SELECT
          id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
          openapi_version, status, is_current, notes, created_at
        FROM api_versions
        WHERE api_id = $1
        ORDER BY is_current DESC, created_at DESC
      `, [apiId]) as any[];

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
      const shouldMakeCurrent = Boolean(make_current);
      const transaction = db.transaction(async client => {
        if (shouldMakeCurrent) {
          await run(client, 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1', [apiId]);
          await run(client, 'UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3', [relativeSpecPath, openapiSpec, apiId]);
        }

        await run(client, `
          INSERT INTO api_versions (
            id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
            openapi_version, status, is_current, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          versionId,
          apiId,
          version,
          relativeSpecPath,
          openapiSpec,
          getSpecSha(openapiSpec),
          metadata.endpointsCount,
          metadata.openapiVersion,
          status || 'Published',
          shouldMakeCurrent,
          notes || null,
        ]);

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
      console.error('[version publish]', err);
      if (err?.code === 'SPEC_INPUT_REQUIRED' || err?.code === 'SPEC_URL_FETCH_FAILED') {
        return res.status(400).json({ error: err.message });
      }
      if (isOpenApiValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
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
        await run(client, 'UPDATE api_versions SET is_current = FALSE WHERE api_id = $1', [apiId]);
        await run(client, 'UPDATE api_versions SET is_current = TRUE WHERE id = $1', [version.id]);
        await run(client, 'UPDATE apis SET openapi_spec_path = $1, openapi_spec_text = $2 WHERE id = $3', [version.openapi_spec_path, version.openapi_spec_text, apiId]);
        await run(client, `
          INSERT INTO audit_logs (id, event_type, api_id, details)
          VALUES ($1, $2, $3, $4)
        `, [generatePublicId('audit'), 'API_VERSION_PROMOTED', apiId, JSON.stringify({ version: requestedVersion })]);
      });

      await transaction;
      res.json({ success: true, version: requestedVersion });
    } catch (err: any) {
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

      await run(db, 'DELETE FROM api_versions WHERE id = $1', [version.id]);
      await run(db, `
        INSERT INTO audit_logs (id, event_type, api_id, details)
        VALUES ($1, $2, $3, $4)
      `, [generatePublicId('audit'), 'API_VERSION_DELETED', apiId, JSON.stringify({ version: requestedVersion })]);

      res.json({ success: true, version: requestedVersion });
    } catch (err: any) {
      console.error('[version delete]', err);
      res.status(500).json({ error: 'Failed to delete version. Please try again.' });
    }
  });

  return router;
}
