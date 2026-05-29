import crypto from 'crypto';
import { Router } from 'express';
import yaml from 'js-yaml';
import type { Db, DbClient } from '../db';
import { one, run } from '../db';
import { requireAuth, optionalAuth } from '../auth';
import { canTransferApiOwnership, requireApiManager } from '../access-control';
import { canDownloadOpenApiAsset, canViewApiDocs, listVisibleDocsApis } from '../docs-access';
import { generatePublicId } from '../ids';
import { getSpecSha, parseSpecMetadata, slugifyVersion, validateOpenApiSpec } from '../versioning';
import { getCurrentSpecForApi, getVersionSpecForApi } from '../openapi-store';
import { resolveCatalogSpecInput } from '../catalog-spec-input';
import { UPDATE_API_SQL } from '../catalog-sql';
import { fetchSpecFromUrl } from '../catalog-spec-url';
import { catalogVersionsRouter } from './catalog-versions';

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

async function mdaExists(db: DbClient, mdaId: string) {
  return Boolean(await one(db, 'SELECT id FROM mdas WHERE id = $1', [mdaId]));
}

export function catalogRouter(db: Db) {
  const router = Router();

  router.get('/', optionalAuth(db), async (req, res) => {
    try {
      const apis = await listVisibleDocsApis(db, req.user);
      res.json(apis);
    } catch (err) {
      res.status(500).json({ error: 'Database not initialized' });
    }
  });

  router.use('/:id/versions', optionalAuth(db), catalogVersionsRouter(db, canViewApiDocs));

  router.get('/:id', optionalAuth(db), async (req, res) => {
    try {
      const apiId = String(req.params.id);
      const decision = await canViewApiDocs(db, req.user, apiId);
      if (decision.allowed === false) {
        return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
      }
      const api = await one(db, 'SELECT * FROM apis WHERE id = $1', [apiId]);
      if (!api) {
        return res.status(404).json({ error: 'API not found' });
      }
      res.json(api);
    } catch (err) {
      res.status(500).json({ error: 'Database not initialized' });
    }
  });

  router.get('/:id/spec', optionalAuth(db), async (req, res) => {
    try {
      const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null;
      const spec = requestedVersion
        ? await getVersionSpecForApi(db, String(req.params.id), requestedVersion)
        : await getCurrentSpecForApi(db, String(req.params.id));
      if (!spec) {
        return res.status(404).json({ error: 'API spec not found' });
      }
      const decision = await canDownloadOpenApiAsset(db, req.user, spec.openapi_spec_path);
      if (decision.allowed === false) {
        return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
      }

      res.json(yaml.load(spec.openapi_spec_text));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to parse spec' });
    }
  });

  router.patch('/:id', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), async (req, res) => {
    const {
      name,
      owning_mda_id,
      sector,
      description,
      lifecycle_status,
      sensitivity_level,
      sandbox_available,
      openapi_spec,
      required_approval_level,
      contact_office,
      technical_owner,
      personal_data_categories,
      purpose_limitation,
      data_minimization_note,
      retention_class,
      statutory_basis,
      security_classification,
      sla_target,
      compliance_status,
      docs_visibility,
    } = req.body;

    try {
      const existing = await one(db, 'SELECT * FROM apis WHERE id = $1', [req.params.id]) as any;
      if (!existing) {
        return res.status(404).json({ error: 'API not found' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'owning_mda_id')) {
        const ownerTransferDecision = canTransferApiOwnership(req.user!);
        if (ownerTransferDecision.allowed === false) {
          return res.status(403).json({ error: ownerTransferDecision.message, code: ownerTransferDecision.code });
        }
        if (typeof owning_mda_id !== 'string' || !(await mdaExists(db, owning_mda_id))) {
          return res.status(400).json({ error: 'owning_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
        }
      }
      const hasDocsVisibilityPatch = Object.prototype.hasOwnProperty.call(req.body, 'docs_visibility');
      const normalizedDocsVisibility = typeof docs_visibility === 'string' && docs_visibility.trim()
        ? docs_visibility.trim().toLowerCase()
        : null;
      if (normalizedDocsVisibility && !['public', 'authenticated', 'restricted'].includes(normalizedDocsVisibility)) {
        return res.status(400).json({ error: 'docs_visibility must be public, authenticated, or restricted.' });
      }

      let specPath = existing.openapi_spec_path;
      let specText = existing.openapi_spec_text;
      let versionPatch: any = null;
      const hasSpecPatch = (typeof openapi_spec === 'string' && openapi_spec.trim()) || (typeof req.body?.specUrl === 'string' && req.body.specUrl.trim());
      if (hasSpecPatch) {
        const resolvedSpec = await resolveCatalogSpecInput(req.body, fetchSpecFromUrl);
        const metadata = parseSpecMetadata(resolvedSpec);
        const currentVersion = await one(db, 'SELECT * FROM api_versions WHERE api_id = $1 AND is_current = TRUE', [req.params.id]) as any;
        const specFilename = currentVersion?.openapi_spec_path
          ? currentVersion.openapi_spec_path.replace(/^\/openapi\/+/, '')
          : `${req.params.id}-${slugifyVersion(metadata.version)}.yaml`;
        specPath = `/openapi/${specFilename}`;
        specText = resolvedSpec;
        versionPatch = {
          versionId: currentVersion?.id || `${req.params.id}-${slugifyVersion(metadata.version)}`,
          version: metadata.version,
          specPath,
          specText: resolvedSpec,
          specSha: getSpecSha(resolvedSpec),
          endpointsCount: metadata.endpointsCount,
          openapiVersion: metadata.openapiVersion,
        };
      }

      const transaction = db.transaction(async client => {
        const trackedFields: Array<[string, unknown, unknown]> = [
          ['name', existing.name, name ?? existing.name],
          ['owning_mda_id', existing.owning_mda_id, owning_mda_id ?? existing.owning_mda_id],
          ['sector', existing.sector, sector ?? existing.sector],
          ['lifecycle_status', existing.lifecycle_status, lifecycle_status ?? existing.lifecycle_status],
          ['sensitivity_level', existing.sensitivity_level, sensitivity_level ?? existing.sensitivity_level],
          ['sandbox_available', Boolean(existing.sandbox_available), typeof sandbox_available === 'boolean' ? sandbox_available : Boolean(existing.sandbox_available)],
          ['required_approval_level', existing.required_approval_level, required_approval_level ?? existing.required_approval_level],
          ['security_classification', existing.security_classification, security_classification ?? existing.security_classification],
          ['docs_visibility', existing.docs_visibility, hasDocsVisibilityPatch ? normalizedDocsVisibility : existing.docs_visibility],
          ['compliance_status', existing.compliance_status, compliance_status ?? existing.compliance_status],
        ];
        const changedFields: Record<string, { from: unknown; to: unknown }> = {};
        for (const [field, from, to] of trackedFields) {
          if (String(from ?? '') !== String(to ?? '')) {
            changedFields[field] = { from, to };
          }
        }

        await run(client, UPDATE_API_SQL, [
          name ?? existing.name,
          owning_mda_id ?? existing.owning_mda_id,
          sector ?? existing.sector,
          description ?? existing.description,
          lifecycle_status ?? existing.lifecycle_status,
          sensitivity_level ?? existing.sensitivity_level,
          typeof sandbox_available === 'boolean' ? sandbox_available : existing.sandbox_available,
          specPath,
          specText,
          required_approval_level ?? existing.required_approval_level,
          contact_office ?? existing.contact_office,
          technical_owner ?? existing.technical_owner,
          personal_data_categories ?? existing.personal_data_categories,
          purpose_limitation ?? existing.purpose_limitation,
          data_minimization_note ?? existing.data_minimization_note,
          retention_class ?? existing.retention_class,
          statutory_basis ?? existing.statutory_basis,
          security_classification ?? existing.security_classification,
          sla_target ?? existing.sla_target,
          compliance_status ?? existing.compliance_status,
          hasDocsVisibilityPatch ? normalizedDocsVisibility : existing.docs_visibility,
          req.params.id,
        ]);

        if (versionPatch) {
          const currentVersion = await one(client, 'SELECT id FROM api_versions WHERE id = $1', [versionPatch.versionId]);
          if (currentVersion) {
            await run(client, `
              UPDATE api_versions SET
                version = $1, openapi_spec_path = $2, openapi_spec_text = $3, spec_sha = $4, endpoints_count = $5, openapi_version = $6, notes = $7
              WHERE id = $8
            `, [
              versionPatch.version,
              versionPatch.specPath,
              versionPatch.specText,
              versionPatch.specSha,
              versionPatch.endpointsCount,
              versionPatch.openapiVersion,
              'Edited by platform administrator',
              versionPatch.versionId,
            ]);
          } else {
            await run(client, `
              INSERT INTO api_versions (
                id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
                openapi_version, status, is_current, notes
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
              versionPatch.versionId,
              req.params.id,
              versionPatch.version,
              versionPatch.specPath,
              versionPatch.specText,
              versionPatch.specSha,
              versionPatch.endpointsCount,
              versionPatch.openapiVersion,
              'Published',
              true,
              'Edited by platform administrator',
            ]);
          }
        }

        await run(client, `
          INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          generatePublicId('audit'),
          'API_UPDATED',
          owning_mda_id ?? existing.owning_mda_id,
          req.params.id,
          JSON.stringify({ api_name: name ?? existing.name, spec_updated: Boolean(versionPatch), changed_fields: changedFields }),
        ]);
      });

      await transaction;
      res.json({ success: true, apiId: req.params.id });
    } catch (err: any) {
      console.error('[api update]', err);
      if (isOpenApiValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to update API. Please try again.' });
    }
  });

  router.delete('/:id', requireAuth(db, ['admin']), async (req, res) => {
    try {
      const api = await one(db, 'SELECT * FROM apis WHERE id = $1', [req.params.id]) as any;
      if (!api) {
        return res.status(404).json({ error: 'API not found' });
      }

      const transaction = db.transaction(async client => {
        await run(client, 'DELETE FROM access_requests WHERE api_id = $1', [req.params.id]);
        await run(client, 'DELETE FROM api_versions WHERE api_id = $1', [req.params.id]);
        await run(client, 'DELETE FROM apis WHERE id = $1', [req.params.id]);
        await run(client, `
          INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          generatePublicId('audit'),
          'API_DELETED',
          api.owning_mda_id,
          req.params.id,
          JSON.stringify({ api_name: api.name }),
        ]);
      });

      await transaction;
      res.json({ success: true, apiId: req.params.id });
    } catch (err: any) {
      console.error('[api delete]', err);
      res.status(500).json({ error: 'Failed to delete API. Please try again.' });
    }
  });

  router.post('/validate-spec', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
    const { specText, specUrl } = req.body;
    try {
      let content = specText || '';
      if (specUrl) {
        try {
          content = await fetchSpecFromUrl(specUrl);
        } catch (fetchErr: any) {
          return res.status(400).json({ valid: false, error: fetchErr.message || 'Failed to fetch spec from URL.' });
        }
      }

      if (!content || !content.trim()) {
        return res.status(400).json({ valid: false, error: 'Empty specification content.' });
      }

      let validation;
      try {
        validation = validateOpenApiSpec(content);
      } catch (validationErr: any) {
        return res.status(400).json({ valid: false, error: validationErr.message });
      }

      res.json({
        valid: true,
        metadata: {
          title: validation.metadata.title,
          version: validation.metadata.version,
          description: validation.metadata.description,
          endpointsCount: validation.metadata.endpointsCount,
        },
      });
    } catch (err: any) {
      console.error('[validate-spec]', err);
      res.status(500).json({ valid: false, error: 'Internal validation error. Please try again.' });
    }
  });

  router.post('/', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
    const {
      name,
      owning_mda_id,
      sector,
      description,
      lifecycle_status,
      sensitivity_level,
      sandbox_available,
      required_approval_level,
      contact_office,
      technical_owner,
      personal_data_categories,
      purpose_limitation,
      data_minimization_note,
      retention_class,
      statutory_basis,
      security_classification,
      sla_target,
      compliance_status,
    } = req.body;

    if (!name || !owning_mda_id) {
      return res.status(400).json({ error: 'Missing mandatory fields: name and owning_mda_id are required.' });
    }
    if (!(await mdaExists(db, owning_mda_id))) {
      return res.status(400).json({ error: 'owning_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
    }
    if (req.user?.role === 'api_owner' && req.user.mda_id !== owning_mda_id) {
      return res.status(403).json({ error: 'API owners can only register APIs for their approved MDA.', code: 'MDA_IMPERSONATION' });
    }

    const id = `api-reg-${crypto.randomUUID()}`;
    const specFilename = `${id}.yaml`;
    const relativeSpecPath = `/openapi/${specFilename}`;

    try {
      const openapiSpec = await resolveCatalogSpecInput(req.body, fetchSpecFromUrl);
      const metadata = parseSpecMetadata(openapiSpec);

      const transaction = db.transaction(async client => {
        await run(client, `
          INSERT INTO apis (
            id, name, owning_mda_id, sector, description, lifecycle_status,
            sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text, required_approval_level, contact_office,
            technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
            retention_class, statutory_basis, security_classification, sla_target, compliance_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        `, [
          id,
          name,
          owning_mda_id,
          sector || 'General',
          description || '',
          lifecycle_status || 'Draft',
          sensitivity_level || 'Medium',
          Boolean(sandbox_available),
          relativeSpecPath,
          openapiSpec,
          required_approval_level || 'General Public',
          contact_office || 'info@govhub.go.ug',
          technical_owner || 'GovHub Systems',
          personal_data_categories || '',
          purpose_limitation || '',
          data_minimization_note || '',
          retention_class || 'Default',
          statutory_basis || 'None',
          security_classification || 'Official',
          sla_target || '99.5%',
          compliance_status || 'Draft',
        ]);

        const versionId = `${id}-${slugifyVersion(metadata.version)}`;
        await run(client, `
          INSERT INTO api_versions (
            id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
            openapi_version, status, is_current, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          versionId,
          id,
          metadata.version,
          relativeSpecPath,
          openapiSpec,
          getSpecSha(openapiSpec),
          metadata.endpointsCount,
          metadata.openapiVersion,
          'Published',
          true,
          'Initial registry version',
        ]);

        const auditId = generatePublicId('audit');
        await run(client, `
          INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          auditId,
          'API_REGISTERED',
          owning_mda_id,
          id,
          JSON.stringify({
            api_name: name,
            registered_by_role: req.user?.role || 'unknown',
            registered_by_user_id: req.user?.id || null,
            sector,
            sensitivity_level,
          }),
        ]);
      });
      await transaction;

      res.status(201).json({ success: true, apiId: id });
    } catch (err: any) {
      console.error('[api register]', err);
      if (err?.code === 'SPEC_INPUT_REQUIRED' || err?.code === 'SPEC_URL_FETCH_FAILED') {
        return res.status(400).json({ error: err.message });
      }
      if (isOpenApiValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'Failed to register API. Please try again.' });
    }
  });

  return router;
}
