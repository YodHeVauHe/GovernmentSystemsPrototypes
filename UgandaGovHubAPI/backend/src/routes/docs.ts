import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { optionalAuth, requireAuth } from '../auth';
import { canManageApi } from '../access-control';
import { resolveOpenApiFilePath } from '../admin';
import { canViewApiDocs, listVisibleDocsApis, resolveDocsVisibility, type DocsVisibility } from '../docs-access';
import type { DbClient } from '../db';
import { one, run } from '../db';

const visibilityValues = new Set<DocsVisibility>(['public', 'authenticated', 'restricted']);

function statusForCode(code: string) {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'UNAUTHENTICATED') return 401;
  return 403;
}

export function docsRouter(db: DbClient) {
  const router = Router();

  router.get('/', optionalAuth(db), async (req, res) => {
    try {
      res.json(await listVisibleDocsApis(db, req.user));
    } catch (err: any) {
      console.error('[docs fetch]', err);
      res.status(500).json({ error: 'Failed to fetch API docs. Please try again.' });
    }
  });

  router.get('/:id', optionalAuth(db), async (req, res) => {
    try {
      const decision = await canViewApiDocs(db, req.user, String(req.params.id));
      if (!decision.allowed) {
        return res.status(statusForCode(decision.code)).json({
          error: decision.message,
          code: decision.code,
          docs_visibility: decision.visibility,
        });
      }

      const api = await one(db, `
        SELECT
          id, name, owning_mda_id, sector, description, lifecycle_status,
          sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level,
          contact_office, technical_owner, security_classification, docs_visibility
        FROM apis
        WHERE id = $1
      `, [req.params.id]);

      if (!api?.openapi_spec_path) {
        return res.status(404).json({ error: 'OpenAPI document is missing for this API.', code: 'SPEC_NOT_FOUND' });
      }

      res.json({
        ...api,
        docs_visibility: resolveDocsVisibility(api),
        spec_url: api.openapi_spec_path,
      });
    } catch (err: any) {
      console.error('[docs/:id fetch]', err);
      res.status(500).json({ error: 'Failed to fetch API documentation. Please try again.' });
    }
  });

  router.get('/:id/spec', optionalAuth(db), async (req, res) => {
    try {
      const decision = await canViewApiDocs(db, req.user, String(req.params.id));
      if (!decision.allowed) {
        return res.status(statusForCode(decision.code)).json({
          error: decision.message,
          code: decision.code,
          docs_visibility: decision.visibility,
        });
      }

      const api = await one(db, 'SELECT openapi_spec_path FROM apis WHERE id = $1', [req.params.id]);
      if (!api?.openapi_spec_path) {
        return res.status(404).json({ error: 'OpenAPI document is missing for this API.', code: 'SPEC_NOT_FOUND' });
      }

      const filePath = resolveOpenApiFilePath(path.join(__dirname, '../../openapi'), String(api.openapi_spec_path));
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Spec file missing on disk', code: 'SPEC_NOT_FOUND' });
      }

      const fileContents = fs.readFileSync(filePath, 'utf8');
      res.json(yaml.load(fileContents));
    } catch (err: any) {
      console.error('[docs/:id/spec fetch]', err);
      res.status(500).json({ error: 'Failed to parse API documentation. Please try again.' });
    }
  });

  router.patch('/:id/visibility', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
    const docsVisibility = String(req.body?.docs_visibility || '').toLowerCase() as DocsVisibility;
    if (!visibilityValues.has(docsVisibility)) {
      return res.status(400).json({ error: 'docs_visibility must be public, authenticated, or restricted.' });
    }

    const managerDecision = await canManageApi(db, req.user!, String(req.params.id));
    if (!managerDecision.allowed) {
      return res.status(403).json({ error: managerDecision.message, code: managerDecision.code });
    }

    try {
      const result = await run(db, 'UPDATE apis SET docs_visibility = $1 WHERE id = $2', [docsVisibility, req.params.id]);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'API not found', code: 'NOT_FOUND' });
      }
      res.json({ id: req.params.id, docs_visibility: docsVisibility });
    } catch (err: any) {
      console.error('[docs visibility update]', err);
      res.status(500).json({ error: 'Failed to update docs visibility. Please try again.' });
    }
  });

  return router;
}
