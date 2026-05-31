import crypto from 'crypto';
import { Router } from 'express';
import type { Db, DbClient } from '../db';
import { one, run } from '../db';
import { requireAuth, optionalAuth, type AuthUser } from '../auth';
import { canTransferApiOwnership, requireApiManager } from '../access-control';
import { canViewApiDocs, listVisibleDocsApis } from '../docs-access';
import { generatePublicId } from '../ids';
import { getSpecSha, parseSpecMetadata, slugifyVersion, validateOpenApiSpec } from '../versioning';
import { getCurrentSpecForApi, getVersionSpecForApi, parseStoredOpenApiSpec } from '../openapi-store';
import { enforceInlineSpecSizeLimit, resolveCatalogSpecInput } from '../catalog-spec-input';
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

function catalogUpdateStaleError() {
  return Object.assign(new Error('This API changed before the update could complete.'), {
    code: 'API_UPDATE_STALE',
  });
}

function catalogRegistrationStaleError() {
  return Object.assign(new Error('Your account permissions changed before registration could complete.'), {
    code: 'API_REGISTRATION_STALE',
  });
}

function integerQueryParam(value: unknown, fallback: number) {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CATALOG_SHORT_TEXT_MAX_LENGTH = 200;
const CATALOG_LONG_TEXT_MAX_LENGTH = 2000;

const catalogTextFieldLimits = {
  name: CATALOG_SHORT_TEXT_MAX_LENGTH,
  owning_mda_id: CATALOG_SHORT_TEXT_MAX_LENGTH,
  sector: CATALOG_SHORT_TEXT_MAX_LENGTH,
  description: CATALOG_LONG_TEXT_MAX_LENGTH,
  lifecycle_status: CATALOG_SHORT_TEXT_MAX_LENGTH,
  sensitivity_level: CATALOG_SHORT_TEXT_MAX_LENGTH,
  required_approval_level: CATALOG_SHORT_TEXT_MAX_LENGTH,
  contact_office: CATALOG_SHORT_TEXT_MAX_LENGTH,
  technical_owner: CATALOG_SHORT_TEXT_MAX_LENGTH,
  personal_data_categories: CATALOG_LONG_TEXT_MAX_LENGTH,
  purpose_limitation: CATALOG_LONG_TEXT_MAX_LENGTH,
  data_minimization_note: CATALOG_LONG_TEXT_MAX_LENGTH,
  retention_class: CATALOG_SHORT_TEXT_MAX_LENGTH,
  statutory_basis: CATALOG_LONG_TEXT_MAX_LENGTH,
  security_classification: CATALOG_SHORT_TEXT_MAX_LENGTH,
  sla_target: CATALOG_SHORT_TEXT_MAX_LENGTH,
  compliance_status: CATALOG_SHORT_TEXT_MAX_LENGTH,
} as const;

type CatalogTextField = keyof typeof catalogTextFieldLimits;
type CatalogTextInput = Partial<Record<CatalogTextField, string | null>>;
type CatalogMetadataValidation =
  | { ok: true; value: CatalogTextInput }
  | { ok: false; message: string };

const catalogMetadataFields = Object.keys(catalogTextFieldLimits) as CatalogTextField[];

const CATALOG_DETAIL_SELECT = `
  SELECT
    id, name, owning_mda_id, sector, description, lifecycle_status,
    sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level,
    contact_office, technical_owner, personal_data_categories, purpose_limitation,
    data_minimization_note, retention_class, statutory_basis, security_classification,
    sla_target, compliance_status, docs_visibility
  FROM apis
  WHERE id = $1
`;

function validateCatalogMetadataInput(
  body: any,
  fields: readonly CatalogTextField[],
  requiredFields: readonly CatalogTextField[] = [],
): CatalogMetadataValidation {
  const sanitized: CatalogTextInput = {};
  const required = new Set(requiredFields);

  for (const field of fields) {
    const hasField = Object.prototype.hasOwnProperty.call(body || {}, field);
    if (!hasField) {
      if (required.has(field)) return { ok: false, message: `${field} is required.` };
      continue;
    }

    const value = body[field];
    if (value === null || value === undefined) {
      if (required.has(field)) return { ok: false, message: `${field} is required.` };
      sanitized[field] = null;
      continue;
    }
    if (typeof value !== 'string') {
      return { ok: false, message: `${field} must be a string.` };
    }

    const trimmed = value.trim();
    if (!trimmed && required.has(field)) {
      return { ok: false, message: `${field} is required.` };
    }
    if (trimmed.length > catalogTextFieldLimits[field]) {
      return { ok: false, message: `${field} must be ${catalogTextFieldLimits[field]} characters or fewer.` };
    }
    sanitized[field] = trimmed;
  }

  return { ok: true, value: sanitized };
}

function resolveCatalogPatchValue(patch: CatalogTextInput, field: CatalogTextField, existingValue: unknown) {
  if (!Object.prototype.hasOwnProperty.call(patch, field)) return existingValue;
  return patch[field] ?? existingValue;
}

async function mdaExists(db: DbClient, mdaId: string) {
  return Boolean(await one(db, 'SELECT id FROM mdas WHERE id = $1', [mdaId]));
}

async function ensureCatalogRegistrationActorCurrent(db: DbClient, user: AuthUser, owningMdaId: string) {
  if (user.role !== 'admin' && user.role !== 'api_owner') {
    throw catalogRegistrationStaleError();
  }
  const currentActor = await one(db, `
    SELECT id
    FROM users
    WHERE id = $1
      AND status = 'APPROVED'
      AND role = $2
      AND ($3 = TRUE OR mda_id = $4)
    FOR UPDATE
  `, [user.id, user.role, user.role === 'admin', owningMdaId]);
  if (!currentActor) {
    throw catalogRegistrationStaleError();
  }
}

export function catalogRouter(db: Db) {
  const router = Router();

  router.get('/', optionalAuth(db), async (req, res) => {
    try {
      const limit = integerQueryParam(req.query.limit, 100);
      const offset = integerQueryParam(req.query.offset, 0);
      const apis = await listVisibleDocsApis(db, req.user, limit, offset);
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
      const api = await one(db, CATALOG_DETAIL_SELECT, [apiId]);
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
      const apiId = String(req.params.id);
      const decision = await canViewApiDocs(db, req.user, apiId);
      if (decision.allowed === false) {
        return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
      }
      const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null;
      const spec = requestedVersion
        ? await getVersionSpecForApi(db, apiId, requestedVersion)
        : await getCurrentSpecForApi(db, apiId);
      if (!spec) {
        return res.status(404).json({ error: 'API spec not found' });
      }

      res.json(parseStoredOpenApiSpec(spec.openapi_spec_text));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to parse spec' });
    }
  });

  router.patch('/:id', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), async (req, res) => {
    try {
      const requiredPatchFields: CatalogTextField[] = [];
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) requiredPatchFields.push('name');
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'owning_mda_id')) requiredPatchFields.push('owning_mda_id');
      const patchValidation = validateCatalogMetadataInput(req.body, catalogMetadataFields, requiredPatchFields);
      if (patchValidation.ok === false) {
        return res.status(400).json({ error: patchValidation.message, code: 'INVALID_CATALOG_METADATA' });
      }
      const patch = patchValidation.value;
      const openapi_spec = req.body?.openapi_spec;
      const sandbox_available = req.body?.sandbox_available;
      const docs_visibility = req.body?.docs_visibility;

      const existing = await one(db, 'SELECT * FROM apis WHERE id = $1', [req.params.id]) as any;
      if (!existing) {
        return res.status(404).json({ error: 'API not found' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'owning_mda_id')) {
        const ownerTransferDecision = canTransferApiOwnership(req.user!);
        if (ownerTransferDecision.allowed === false) {
          return res.status(403).json({ error: ownerTransferDecision.message, code: ownerTransferDecision.code });
        }
        if (!(await mdaExists(db, patch.owning_mda_id!))) {
          return res.status(400).json({ error: 'owning_mda_id must reference an existing MDA.', code: 'MDA_NOT_FOUND' });
        }
      }
      const hasDocsVisibilityPatch = Object.prototype.hasOwnProperty.call(req.body, 'docs_visibility');
      if (hasDocsVisibilityPatch && docs_visibility !== null && docs_visibility !== undefined && docs_visibility !== '' && typeof docs_visibility !== 'string') {
        return res.status(400).json({ error: 'docs_visibility must be public, authenticated, or restricted.', code: 'INVALID_CATALOG_METADATA' });
      }
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
        const nextName = resolveCatalogPatchValue(patch, 'name', existing.name);
        const nextOwningMdaId = resolveCatalogPatchValue(patch, 'owning_mda_id', existing.owning_mda_id);
        const nextSector = resolveCatalogPatchValue(patch, 'sector', existing.sector);
        const nextDescription = resolveCatalogPatchValue(patch, 'description', existing.description);
        const nextLifecycleStatus = resolveCatalogPatchValue(patch, 'lifecycle_status', existing.lifecycle_status);
        const nextSensitivityLevel = resolveCatalogPatchValue(patch, 'sensitivity_level', existing.sensitivity_level);
        const nextRequiredApprovalLevel = resolveCatalogPatchValue(patch, 'required_approval_level', existing.required_approval_level);
        const nextContactOffice = resolveCatalogPatchValue(patch, 'contact_office', existing.contact_office);
        const nextTechnicalOwner = resolveCatalogPatchValue(patch, 'technical_owner', existing.technical_owner);
        const nextPersonalDataCategories = resolveCatalogPatchValue(patch, 'personal_data_categories', existing.personal_data_categories);
        const nextPurposeLimitation = resolveCatalogPatchValue(patch, 'purpose_limitation', existing.purpose_limitation);
        const nextDataMinimizationNote = resolveCatalogPatchValue(patch, 'data_minimization_note', existing.data_minimization_note);
        const nextRetentionClass = resolveCatalogPatchValue(patch, 'retention_class', existing.retention_class);
        const nextStatutoryBasis = resolveCatalogPatchValue(patch, 'statutory_basis', existing.statutory_basis);
        const nextSecurityClassification = resolveCatalogPatchValue(patch, 'security_classification', existing.security_classification);
        const nextSlaTarget = resolveCatalogPatchValue(patch, 'sla_target', existing.sla_target);
        const nextComplianceStatus = resolveCatalogPatchValue(patch, 'compliance_status', existing.compliance_status);
        const trackedFields: Array<[string, unknown, unknown]> = [
          ['name', existing.name, nextName],
          ['owning_mda_id', existing.owning_mda_id, nextOwningMdaId],
          ['sector', existing.sector, nextSector],
          ['lifecycle_status', existing.lifecycle_status, nextLifecycleStatus],
          ['sensitivity_level', existing.sensitivity_level, nextSensitivityLevel],
          ['sandbox_available', Boolean(existing.sandbox_available), typeof sandbox_available === 'boolean' ? sandbox_available : Boolean(existing.sandbox_available)],
          ['required_approval_level', existing.required_approval_level, nextRequiredApprovalLevel],
          ['security_classification', existing.security_classification, nextSecurityClassification],
          ['docs_visibility', existing.docs_visibility, hasDocsVisibilityPatch ? normalizedDocsVisibility : existing.docs_visibility],
          ['compliance_status', existing.compliance_status, nextComplianceStatus],
        ];
        const changedFields: Record<string, { from: unknown; to: unknown }> = {};
        for (const [field, from, to] of trackedFields) {
          if (String(from ?? '') !== String(to ?? '')) {
            changedFields[field] = { from, to };
          }
        }

        const guardedUpdateSql = `${UPDATE_API_SQL.trim()} AND ($23 = TRUE OR owning_mda_id = $24)`;
        const apiUpdate = await run(client, guardedUpdateSql, [
          nextName,
          nextOwningMdaId,
          nextSector,
          nextDescription,
          nextLifecycleStatus,
          nextSensitivityLevel,
          typeof sandbox_available === 'boolean' ? sandbox_available : existing.sandbox_available,
          specPath,
          specText,
          nextRequiredApprovalLevel,
          nextContactOffice,
          nextTechnicalOwner,
          nextPersonalDataCategories,
          nextPurposeLimitation,
          nextDataMinimizationNote,
          nextRetentionClass,
          nextStatutoryBasis,
          nextSecurityClassification,
          nextSlaTarget,
          nextComplianceStatus,
          hasDocsVisibilityPatch ? normalizedDocsVisibility : existing.docs_visibility,
          req.params.id,
          req.user!.role === 'admin',
          req.user!.mda_id,
        ]);
        if (apiUpdate.changes !== 1) {
          throw catalogUpdateStaleError();
        }

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
          nextOwningMdaId,
          req.params.id,
          JSON.stringify({ api_name: nextName, spec_updated: Boolean(versionPatch), changed_fields: changedFields }),
        ]);
      });

      await transaction;
      res.json({ success: true, apiId: req.params.id });
    } catch (err: any) {
      if (err?.code === 'API_UPDATE_STALE') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
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
    if (specText !== undefined && specText !== null && specText !== '' && typeof specText !== 'string') {
      return res.status(400).json({ valid: false, error: 'specText must be a string.' });
    }
    if (specUrl !== undefined && specUrl !== null && specUrl !== '' && typeof specUrl !== 'string') {
      return res.status(400).json({ valid: false, error: 'specUrl must be a string.' });
    }

    try {
      let content = specText ? enforceInlineSpecSizeLimit(specText) : '';
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
    const metadataValidation = validateCatalogMetadataInput(req.body, catalogMetadataFields, ['name', 'owning_mda_id']);
    if (metadataValidation.ok === false) {
      return res.status(400).json({ error: metadataValidation.message, code: 'INVALID_CATALOG_METADATA' });
    }
    const catalogMetadata = metadataValidation.value;
    const name = catalogMetadata.name!;
    const owning_mda_id = catalogMetadata.owning_mda_id!;
    const sandboxAvailable = req.body?.sandbox_available;
    if (sandboxAvailable !== undefined && sandboxAvailable !== null && typeof sandboxAvailable !== 'boolean') {
      return res.status(400).json({ error: 'sandbox_available must be a boolean.', code: 'INVALID_CATALOG_METADATA' });
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
      const specMetadata = parseSpecMetadata(openapiSpec);

      const transaction = db.transaction(async client => {
        await ensureCatalogRegistrationActorCurrent(client, req.user!, owning_mda_id);

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
          catalogMetadata.sector || 'General',
          catalogMetadata.description || '',
          catalogMetadata.lifecycle_status || 'Draft',
          catalogMetadata.sensitivity_level || 'Medium',
          sandboxAvailable === true,
          relativeSpecPath,
          openapiSpec,
          catalogMetadata.required_approval_level || 'General Public',
          catalogMetadata.contact_office || 'info@govhub.go.ug',
          catalogMetadata.technical_owner || 'GovHub Systems',
          catalogMetadata.personal_data_categories || '',
          catalogMetadata.purpose_limitation || '',
          catalogMetadata.data_minimization_note || '',
          catalogMetadata.retention_class || 'Default',
          catalogMetadata.statutory_basis || 'None',
          catalogMetadata.security_classification || 'Official',
          catalogMetadata.sla_target || '99.5%',
          catalogMetadata.compliance_status || 'Draft',
        ]);

        const versionId = `${id}-${slugifyVersion(specMetadata.version)}`;
        await run(client, `
          INSERT INTO api_versions (
            id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha, endpoints_count,
            openapi_version, status, is_current, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          versionId,
          id,
          specMetadata.version,
          relativeSpecPath,
          openapiSpec,
          getSpecSha(openapiSpec),
          specMetadata.endpointsCount,
          specMetadata.openapiVersion,
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
            sector: catalogMetadata.sector || 'General',
            sensitivity_level: catalogMetadata.sensitivity_level || 'Medium',
          }),
        ]);
      });
      await transaction;

      res.status(201).json({ success: true, apiId: id });
    } catch (err: any) {
      if (err?.code === 'API_REGISTRATION_STALE') {
        return res.status(409).json({ error: err.message, code: err.code });
      }
      if (err?.code === 'SPEC_INPUT_REQUIRED' || err?.code === 'SPEC_URL_FETCH_FAILED') {
        return res.status(400).json({ error: err.message });
      }
      if (isOpenApiValidationError(err)) {
        return res.status(400).json({ error: err.message });
      }
      console.error('[api register]', err);
      res.status(500).json({ error: 'Failed to register API. Please try again.' });
    }
  });

  return router;
}
