import { Router } from 'express';
import type { Db } from '../db';
import { optionalAuth } from '../auth';
import { canViewApiDocs } from '../docs-access';
import { getSpecByPath, normalizeOpenApiPath } from '../openapi-store';

function statusForDownloadDecision(code: string) {
  if (code === 'UNAUTHENTICATED') return 401;
  if (code === 'NOT_FOUND') return 404;
  return 403;
}

export function openApiAssetsRouter(db: Db) {
  const router = Router();

  router.get('/openapi/:filename', optionalAuth(db), async (req, res) => {
    const openapiPath = normalizeOpenApiPath(String(req.params.filename));
    if (!openapiPath) {
      return res.status(404).json({ error: 'API documentation was not found.', code: 'NOT_FOUND' });
    }

    const spec = await getSpecByPath(db, openapiPath);
    if (!spec) {
      return res.status(404).json({ error: 'Spec not found', code: 'SPEC_NOT_FOUND' });
    }

    const decision = await canViewApiDocs(db, req.user, spec.api_id);
    if (decision.allowed === false) {
      return res.status(statusForDownloadDecision(decision.code)).json({ error: decision.message, code: decision.code });
    }

    res.type('yaml').send(spec.openapi_spec_text);
  });

  return router;
}
