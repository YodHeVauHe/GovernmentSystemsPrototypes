import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import crypto from 'crypto';
import dns from 'dns/promises';
import net from 'net';
import { sandboxMiddleware } from './middleware/sandbox';
import { identityRouter } from './routes/identity';
import { taxRouter } from './routes/tax';
import { businessRouter } from './routes/business';
import { accessRouter } from './routes/access';
import { drivingPermitRouter } from './routes/driving-permit';
import { compositeRouter } from './routes/composite';
import { ensureApiVersionSchema, getSpecSha, parseSpecMetadata, slugifyVersion, validateOpenApiSpec } from './versioning';
import { deleteSpecFiles, ensureAdminSchema, removeExistingSpecFiles, resolveOpenApiFilePath } from './admin';
import { ensureAuthSchema, ensureDefaultAdmin, ensureDemoUsers, optionalAuth, requireAuth } from './auth';
import { adminUsersRouter, authRouter } from './routes/auth';
import { canTransferApiOwnership, requireApiManager } from './access-control';
import { ensureAccountVerificationSchema } from './account-verification';
import { ensureDocsSchema } from './docs-access';
import { canDownloadOpenApiAsset, canViewApiDocs, listVisibleDocsApis } from './docs-access';
import { docsRouter } from './routes/docs';
import { generatePublicId } from './ids';
import { initAuditColumnCache } from './audit';
import { createTransportServer, getTlsConfig } from './tls';
import { resolveCatalogSpecInput } from './catalog-spec-input';
import { UPDATE_API_SQL } from './catalog-sql';
import { shouldRemoveOpenApiFile } from './openapi-reconciliation';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
const openapiRoot = path.join(__dirname, '../openapi');

const allowedOrigins = (process.env.GOVHUB_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
  exposedHeaders: [
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
}));
app.use((req, res, next) => {
  const tlsEnabled = getTlsConfig().enabled || process.env.GOVHUB_TRUST_TLS_TERMINATION === 'true';
  if (tlsEnabled) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(express.json({ limit: process.env.GOVHUB_JSON_LIMIT || '1mb' }));

// Initialize SQLite Database
export const db = new Database(path.join(__dirname, '../data/govhub.db'));
db.pragma('foreign_keys = ON');
ensureAdminSchema(db);
ensureApiVersionSchema(db);
ensureAuthSchema(db);
ensureDefaultAdmin(db);
ensureDemoUsers(db);
ensureAccountVerificationSchema(db);
ensureDocsSchema(db);
initAuditColumnCache(db); // warm the audit column cache after all schema migrations

// Startup reconciliation: remove any spec files on disk that have no matching DB row.
// This recovers from a crash between the DB transaction commit and the file deletion.
(function reconcileOrphanedSpecFiles() {
  if (!fs.existsSync(openapiRoot)) return;
  const knownPaths = new Set<string>();
  try {
    const rows = db.prepare('SELECT openapi_spec_path FROM apis WHERE openapi_spec_path IS NOT NULL').all() as any[];
    const versionRows = db.prepare('SELECT openapi_spec_path FROM api_versions WHERE openapi_spec_path IS NOT NULL').all() as any[];
    for (const row of [...rows, ...versionRows]) {
      if (typeof row.openapi_spec_path === 'string') {
        knownPaths.add(path.basename(row.openapi_spec_path));
      }
    }
    const diskFiles = fs.readdirSync(openapiRoot).filter(file => shouldRemoveOpenApiFile(file, knownPaths));
    for (const file of diskFiles) {
      const orphan = path.join(openapiRoot, file);
      console.warn(`[STARTUP] Removing orphaned spec file: ${orphan}`);
      try { fs.unlinkSync(orphan); } catch (e) { console.error(`[STARTUP] Failed to remove orphan: ${orphan}`, e); }
    }
  } catch (err) {
    console.error('[STARTUP] Orphan spec reconciliation failed:', err);
  }
})();

function statusForDocsDecision(code: string) {
  if (code === 'UNAUTHENTICATED') return 401;
  if (code === 'NOT_FOUND') return 404;
  return 403;
}

function isPrivateIp(address: string) {
  const family = net.isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return true;
}

/**
 * Resolve, validate, and fetch a remote OpenAPI spec.
 *
 * DNS-rebinding mitigation: we resolve the hostname once, check all resolved
 * IPs against the private-range block-list, then make the HTTP request by
 * connecting directly to one of those pinned IPs (passing the original Host
 * header for SNI/virtual-hosting). This prevents an attacker-controlled DNS
 * server from swapping a public IP at validation time for a private IP at
 * fetch time.
 */
async function fetchSpecFromUrl(specUrl: string): Promise<string> {
  const parsed = new URL(specUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https spec URLs are supported.');
  }

  const allowedHosts = (process.env.GOVHUB_SPEC_URL_HOSTS || '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean);
  const allowUnlistedHosts = process.env.GOVHUB_ALLOW_UNLISTED_SPEC_URLS === 'true';
  if (!allowedHosts.length && !allowUnlistedHosts) {
    throw new Error('Spec URL imports require GOVHUB_SPEC_URL_HOSTS or GOVHUB_ALLOW_UNLISTED_SPEC_URLS=true.');
  }
  if (allowedHosts.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new Error('Spec URL host is not allowed.');
  }

  // Resolve once and pin — prevents DNS rebinding TOCTOU
  const addresses = await dns.lookup(parsed.hostname, { all: true, verbatim: false });
  if (!addresses.length) {
    throw new Error('Spec URL hostname could not be resolved.');
  }
  const blocked = addresses.filter(a => isPrivateIp(a.address));
  if (blocked.length) {
    throw new Error('Spec URL resolves to a blocked private or local address.');
  }

  // Pick a safe resolved IP to connect to directly
  const pinnedIp = addresses[0].address;
  const isIpv6 = net.isIPv6(pinnedIp);

  // Build a URL that connects to the pinned IP but keeps the original Host header
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const pinnedHost = isIpv6 ? `[${pinnedIp}]` : pinnedIp;
  const pinnedUrl = new URL(specUrl);
  pinnedUrl.hostname = pinnedHost;
  if (parsed.port) pinnedUrl.port = parsed.port;

  const controller = new AbortController();
  const timeoutMs = Number(process.env.GOVHUB_SPEC_FETCH_TIMEOUT_MS || 5000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(pinnedUrl.toString(), {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        // Preserve original Host so SNI and virtual-hosting work correctly
        Host: parsed.hostname + (parsed.port ? `:${port}` : ''),
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch spec from URL: ${response.statusText}`);
    }
    const maxBytes = Number(process.env.GOVHUB_SPEC_MAX_BYTES || 1024 * 1024);
    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error('Specification content is too large.');
    }
    const content = await response.text();
    if (Buffer.byteLength(content, 'utf8') > maxBytes) {
      throw new Error('Specification content is too large.');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function mdaExists(mdaId: string) {
  return Boolean(db.prepare('SELECT id FROM mdas WHERE id = ?').get(mdaId));
}

function writeOpenApiSpecFile(filename: string, content: string) {
  const finalPath = path.join(openapiRoot, path.basename(filename));
  const tempPath = `${finalPath}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, content, 'utf8');
  return {
    finalPath,
    tempPath,
    commit() {
      fs.renameSync(tempPath, finalPath);
    },
    cleanup() {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    },
  };
}

function isOpenApiValidationError(err: any) {
  const message = String(err?.message || '');
  return message.startsWith('Invalid specification:') || message === 'Specification parsed to an invalid object.';
}

// Serve static OpenAPI files through the same visibility policy used by /api/docs.
app.use('/openapi', optionalAuth(db), (req, res, next) => {
  const decision = canDownloadOpenApiAsset(db, req.user, `/openapi${req.path}`);
  if (!decision.allowed) {
    const status = decision.code === 'UNAUTHENTICATED' ? 401 : decision.code === 'NOT_FOUND' ? 404 : 403;
    return res.status(status).json({ error: decision.message, code: decision.code });
  }
  next();
}, express.static(openapiRoot));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Uganda GovHub API Mock Sandbox' });
});

app.use('/api/auth', authRouter(db));
app.use('/api/admin/users', adminUsersRouter(db));
app.use('/api/docs', docsRouter(db));

// Seed API Catalog route
app.get('/api/catalog', optionalAuth(db), (req, res) => {
  try {
    const apis = listVisibleDocsApis(db, req.user);
    res.json(apis);
  } catch (err) {
    res.status(500).json({ error: 'Database not initialized' });
  }
});

// Get single API by ID
app.get('/api/catalog/:id', optionalAuth(db), (req, res) => {
  try {
    const apiId = String(req.params.id);
    const decision = canViewApiDocs(db, req.user, apiId);
    if (!decision.allowed) {
      return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
    }
    const api = db.prepare('SELECT * FROM apis WHERE id = ?').get(apiId);
    if (!api) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.json(api);
  } catch (err) {
    res.status(500).json({ error: 'Database not initialized' });
  }
});

app.get('/api/catalog/:id/versions', optionalAuth(db), (req, res) => {
  try {
    const apiId = String(req.params.id);
    const decision = canViewApiDocs(db, req.user, apiId);
    if (!decision.allowed) {
      return res.status(statusForDocsDecision(decision.code)).json({ error: decision.message, code: decision.code });
    }
    const current = db.prepare('SELECT spec_sha FROM api_versions WHERE api_id = ? AND is_current = 1').get(apiId) as any;
    const versions = db.prepare(`
      SELECT
        id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes, created_at
      FROM api_versions
      WHERE api_id = ?
      ORDER BY is_current DESC, created_at DESC
    `).all(apiId) as any[];

    res.json(versions.map(version => ({
      ...version,
      is_current: Boolean(version.is_current),
      sync_status: current?.spec_sha === version.spec_sha ? 'current' : 'available'
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch API versions' });
  }
});

app.post('/api/catalog/:id/versions', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), async (req, res) => {
  const { status, notes, make_current } = req.body;

  try {
    const openapiSpec = await resolveCatalogSpecInput(req.body, fetchSpecFromUrl);
    const api = db.prepare('SELECT id FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!api) {
      return res.status(404).json({ error: 'API not found' });
    }

    const metadata = parseSpecMetadata(openapiSpec);
    const version = metadata.version;
    const existing = db.prepare('SELECT id FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, version);
    if (existing) {
      return res.status(409).json({ error: `Version ${version} already exists for this API.` });
    }

    const versionId = `${req.params.id}-${slugifyVersion(version)}`;
    const specFilename = `${versionId}.yaml`;
    const relativeSpecPath = `/openapi/${specFilename}`;
    const specFile = writeOpenApiSpecFile(specFilename, openapiSpec);

    const insertVersion = db.prepare(`
      INSERT INTO api_versions (
        id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const shouldMakeCurrent = Boolean(make_current);
    try {
      const transaction = db.transaction(() => {
        if (shouldMakeCurrent) {
          db.prepare('UPDATE api_versions SET is_current = 0 WHERE api_id = ?').run(req.params.id);
          db.prepare('UPDATE apis SET openapi_spec_path = ? WHERE id = ?').run(relativeSpecPath, req.params.id);
        }

        insertVersion.run(
          versionId,
          req.params.id,
          version,
          relativeSpecPath,
          getSpecSha(openapiSpec),
          metadata.endpointsCount,
          metadata.openapiVersion,
          status || 'Published',
          shouldMakeCurrent ? 1 : 0,
          notes || null
        );

        db.prepare(`
          INSERT INTO audit_logs (id, event_type, api_id, details)
          VALUES (?, ?, ?, ?)
        `).run(
          generatePublicId('audit'),
          'API_VERSION_PUBLISHED',
          req.params.id,
          JSON.stringify({ version, make_current: shouldMakeCurrent, endpoints_count: metadata.endpointsCount })
        );
      });

      transaction();
      specFile.commit();
    } catch (err) {
      specFile.cleanup();
      throw err;
    }
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

app.post('/api/catalog/:id/versions/:version/current', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), (req, res) => {
  try {
    const version = db.prepare('SELECT * FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, req.params.version) as any;
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE api_versions SET is_current = 0 WHERE api_id = ?').run(req.params.id);
      db.prepare('UPDATE api_versions SET is_current = 1 WHERE id = ?').run(version.id);
      db.prepare('UPDATE apis SET openapi_spec_path = ? WHERE id = ?').run(version.openapi_spec_path, req.params.id);
      db.prepare(`
        INSERT INTO audit_logs (id, event_type, api_id, details)
        VALUES (?, ?, ?, ?)
      `).run(generatePublicId('audit'), 'API_VERSION_PROMOTED', req.params.id, JSON.stringify({ version: req.params.version }));
    });

    transaction();
    res.json({ success: true, version: req.params.version });
  } catch (err: any) {
    console.error('[version promote]', err);
    res.status(500).json({ error: 'Failed to promote version. Please try again.' });
  }
});

app.delete('/api/catalog/:id/versions/:version', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), (req, res) => {
  try {
    const version = db.prepare('SELECT * FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, req.params.version) as any;
    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }
    if (version.is_current) {
      return res.status(409).json({ error: 'Cannot delete the current version. Promote another version first.' });
    }

    db.prepare('DELETE FROM api_versions WHERE id = ?').run(version.id);
    db.prepare(`
      INSERT INTO audit_logs (id, event_type, api_id, details)
      VALUES (?, ?, ?, ?)
    `).run(generatePublicId('audit'), 'API_VERSION_DELETED', req.params.id, JSON.stringify({ version: req.params.version }));

    res.json({ success: true, version: req.params.version });
  } catch (err: any) {
    console.error('[version delete]', err);
    res.status(500).json({ error: 'Failed to delete version. Please try again.' });
  }
});

// Get parsed OpenAPI spec by API ID
app.get('/api/catalog/:id/spec', optionalAuth(db), (req, res) => {
  try {
    const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null;
    const api = requestedVersion
      ? db.prepare('SELECT openapi_spec_path FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, requestedVersion) as any
      : db.prepare('SELECT openapi_spec_path FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!api || !api.openapi_spec_path) {
      return res.status(404).json({ error: 'API spec not found' });
    }
    const decision = canDownloadOpenApiAsset(db, req.user, api.openapi_spec_path);
    if (!decision.allowed) {
      const status = decision.code === 'UNAUTHENTICATED' ? 401 : decision.code === 'NOT_FOUND' ? 404 : 403;
      return res.status(status).json({ error: decision.message, code: decision.code });
    }
    
    const filePath = resolveOpenApiFilePath(openapiRoot, api.openapi_spec_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Spec file missing on disk' });
    }
    
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(fileContents);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse spec' });
  }
});

app.patch('/api/catalog/:id', requireAuth(db, ['admin', 'api_owner']), requireApiManager(db, req => String(req.params.id)), async (req, res) => {
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
    const existing = db.prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'API not found' });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'owning_mda_id')) {
      const ownerTransferDecision = canTransferApiOwnership(req.user!);
      if (!ownerTransferDecision.allowed) {
        return res.status(403).json({ error: ownerTransferDecision.message, code: ownerTransferDecision.code });
      }
      if (typeof owning_mda_id !== 'string' || !mdaExists(owning_mda_id)) {
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
    let versionPatch: any = null;
    let pendingSpecFile: ReturnType<typeof writeOpenApiSpecFile> | null = null;
    const hasSpecPatch = (typeof openapi_spec === 'string' && openapi_spec.trim()) || (typeof req.body?.specUrl === 'string' && req.body.specUrl.trim());
    if (hasSpecPatch) {
      const resolvedSpec = await resolveCatalogSpecInput(req.body, fetchSpecFromUrl);
      const metadata = parseSpecMetadata(resolvedSpec);
      const currentVersion = db.prepare('SELECT * FROM api_versions WHERE api_id = ? AND is_current = 1').get(req.params.id) as any;
      const specFilename = currentVersion?.openapi_spec_path
        ? path.basename(currentVersion.openapi_spec_path)
        : `${req.params.id}-${slugifyVersion(metadata.version)}.yaml`;
      specPath = `/openapi/${specFilename}`;
      pendingSpecFile = writeOpenApiSpecFile(specFilename, resolvedSpec);
      versionPatch = {
        versionId: currentVersion?.id || `${req.params.id}-${slugifyVersion(metadata.version)}`,
        version: metadata.version,
        specPath,
        specSha: getSpecSha(resolvedSpec),
        endpointsCount: metadata.endpointsCount,
        openapiVersion: metadata.openapiVersion,
      };
    }

    const transaction = db.transaction(() => {
      // Compute field-level diff for the audit log before writing.
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

      db.prepare(UPDATE_API_SQL).run(
        name ?? existing.name,
        owning_mda_id ?? existing.owning_mda_id,
        sector ?? existing.sector,
        description ?? existing.description,
        lifecycle_status ?? existing.lifecycle_status,
        sensitivity_level ?? existing.sensitivity_level,
        typeof sandbox_available === 'boolean' ? (sandbox_available ? 1 : 0) : existing.sandbox_available,
        specPath,
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
        req.params.id
      );

      if (versionPatch) {
        const currentVersion = db.prepare('SELECT id FROM api_versions WHERE id = ?').get(versionPatch.versionId);
        if (currentVersion) {
          db.prepare(`
            UPDATE api_versions SET
              version = ?, openapi_spec_path = ?, spec_sha = ?, endpoints_count = ?, openapi_version = ?, notes = ?
            WHERE id = ?
          `).run(
            versionPatch.version,
            versionPatch.specPath,
            versionPatch.specSha,
            versionPatch.endpointsCount,
            versionPatch.openapiVersion,
            'Edited by platform administrator',
            versionPatch.versionId
          );
        } else {
          db.prepare(`
            INSERT INTO api_versions (
              id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
              openapi_version, status, is_current, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            versionPatch.versionId,
            req.params.id,
            versionPatch.version,
            versionPatch.specPath,
            versionPatch.specSha,
            versionPatch.endpointsCount,
            versionPatch.openapiVersion,
            'Published',
            1,
            'Edited by platform administrator'
          );
        }
      }

      db.prepare(`
        INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        generatePublicId('audit'),
        'API_UPDATED',
        owning_mda_id ?? existing.owning_mda_id,
        req.params.id,
        JSON.stringify({ api_name: name ?? existing.name, spec_updated: Boolean(versionPatch), changed_fields: changedFields })
      );
    });

    try {
      transaction();
      if (pendingSpecFile) pendingSpecFile.commit();
    } catch (err) {
      if (pendingSpecFile) pendingSpecFile.cleanup();
      throw err;
    }
    res.json({ success: true, apiId: req.params.id });
  } catch (err: any) {
    console.error('[api update]', err);
    if (isOpenApiValidationError(err)) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to update API. Please try again.' });
  }
});

app.delete('/api/catalog/:id', requireAuth(db, ['admin']), (req, res) => {
  try {
    const api = db.prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!api) {
      return res.status(404).json({ error: 'API not found' });
    }

    const versionSpecs = db.prepare('SELECT openapi_spec_path FROM api_versions WHERE api_id = ?').all(req.params.id) as any[];
    const specPaths = removeExistingSpecFiles([
      api.openapi_spec_path,
      ...versionSpecs.map(version => version.openapi_spec_path),
    ]);

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM access_requests WHERE api_id = ?').run(req.params.id);
      db.prepare('DELETE FROM api_versions WHERE api_id = ?').run(req.params.id);
      db.prepare('DELETE FROM apis WHERE id = ?').run(req.params.id);
      db.prepare(`
        INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        generatePublicId('audit'),
        'API_DELETED',
        api.owning_mda_id,
        req.params.id,
        JSON.stringify({ api_name: api.name, removed_spec_files: specPaths })
      );
    });

    transaction();
    deleteSpecFiles(specPaths, openapiRoot);
    res.json({ success: true, apiId: req.params.id });
  } catch (err: any) {
    console.error('[api delete]', err);
    res.status(500).json({ error: 'Failed to delete API. Please try again.' });
  }
});

app.post('/api/catalog/validate-spec', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
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
        endpointsCount: validation.metadata.endpointsCount
      }
    });
  } catch (err: any) {
    console.error('[validate-spec]', err);
    res.status(500).json({ valid: false, error: 'Internal validation error. Please try again.' });
  }
});

app.post('/api/catalog', requireAuth(db, ['admin', 'api_owner']), async (req, res) => {
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
    compliance_status
  } = req.body;

  if (!name || !owning_mda_id) {
    return res.status(400).json({ error: 'Missing mandatory fields: name and owning_mda_id are required.' });
  }
  if (!mdaExists(owning_mda_id)) {
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
    const specFile = writeOpenApiSpecFile(specFilename, openapiSpec);

    // Insert into SQLite database
    const stmt = db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, sector, description, lifecycle_status,
        sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level, contact_office,
        technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
        retention_class, statutory_basis, security_classification, sla_target, compliance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const transaction = db.transaction(() => {
        stmt.run(
          id,
          name,
          owning_mda_id,
          sector || 'General',
          description || '',
          lifecycle_status || 'Draft',
          sensitivity_level || 'Medium',
          sandbox_available ? 1 : 0,
          relativeSpecPath,
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
          compliance_status || 'Draft'
        );

        const versionId = `${id}-${slugifyVersion(metadata.version)}`;
        db.prepare(`
          INSERT INTO api_versions (
            id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
            openapi_version, status, is_current, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          versionId,
          id,
          metadata.version,
          relativeSpecPath,
          getSpecSha(openapiSpec),
          metadata.endpointsCount,
          metadata.openapiVersion,
          'Published',
          1,
          'Initial registry version'
        );

        const auditStmt = db.prepare(`
          INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
          VALUES (?, ?, ?, ?, ?)
        `);
        const auditId = generatePublicId('audit');
        auditStmt.run(
          auditId,
          'API_REGISTERED',
          owning_mda_id,
          id,
          JSON.stringify({
            api_name: name,
            registered_by_role: req.user?.role || 'unknown',
            registered_by_user_id: req.user?.id || null,
            sector,
            sensitivity_level
          })
        );
      });
      transaction();
      specFile.commit();
    } catch (err) {
      specFile.cleanup();
      throw err;
    }

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

// Access Management API
app.use('/api/access', accessRouter(db));

// --- SANDBOX APIs ---
app.use('/api/v1', sandboxMiddleware(db));
app.use('/api/v1/identity', identityRouter);
app.use('/api/v1/tax', taxRouter);
app.use('/api/v1/business', businessRouter);
app.use('/api/v1/transport/driving-permit', drivingPermitRouter);
app.use('/api/v1/service-uganda', compositeRouter);
app.use('/api/v1', (req, res) => {
  res.json({
    requestId: res.getHeader('X-Correlation-ID'),
    status: 'ok',
    sandbox: true,
    message: 'Dynamic sandbox mock response generated from a registered OpenAPI server path.',
    path: req.originalUrl,
    method: req.method,
  });
});

export const server = createTransportServer(app).listen(port, host, () => {
  const protocol = getTlsConfig().enabled ? 'https' : 'http';
  console.log(`Backend running at ${protocol}://${host}:${port}`);
});
