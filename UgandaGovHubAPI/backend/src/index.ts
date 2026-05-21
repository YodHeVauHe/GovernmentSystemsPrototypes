import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { sandboxMiddleware } from './middleware/sandbox';
import { identityRouter } from './routes/identity';
import { taxRouter } from './routes/tax';
import { businessRouter } from './routes/business';
import { accessRouter } from './routes/access';
import { drivingPermitRouter } from './routes/driving-permit';
import { compositeRouter } from './routes/composite';
import { ensureApiVersionSchema, getSpecSha, parseSpecMetadata, slugifyVersion } from './versioning';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  exposedHeaders: [
    'X-Correlation-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
}));
app.use(express.json());

// Initialize SQLite Database
export const db = new Database(path.join(__dirname, '../data/govhub.db'));
ensureApiVersionSchema(db);

// Serve static OpenAPI files
app.use('/openapi', express.static(path.join(__dirname, '../openapi')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Uganda GovHub API Mock Sandbox' });
});

// Seed API Catalog route
app.get('/api/catalog', (req, res) => {
  try {
    const apis = db.prepare('SELECT * FROM apis').all();
    res.json(apis);
  } catch (err) {
    res.status(500).json({ error: 'Database not initialized' });
  }
});

// Get single API by ID
app.get('/api/catalog/:id', (req, res) => {
  try {
    const api = db.prepare('SELECT * FROM apis WHERE id = ?').get(req.params.id);
    if (!api) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.json(api);
  } catch (err) {
    res.status(500).json({ error: 'Database not initialized' });
  }
});

app.get('/api/catalog/:id/versions', (req, res) => {
  try {
    const current = db.prepare('SELECT spec_sha FROM api_versions WHERE api_id = ? AND is_current = 1').get(req.params.id) as any;
    const versions = db.prepare(`
      SELECT
        id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes, created_at
      FROM api_versions
      WHERE api_id = ?
      ORDER BY is_current DESC, created_at DESC
    `).all(req.params.id) as any[];

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

app.post('/api/catalog/:id/versions', (req, res) => {
  const { openapi_spec, status, notes, make_current } = req.body;

  if (!openapi_spec || !openapi_spec.trim()) {
    return res.status(400).json({ error: 'openapi_spec is required.' });
  }

  try {
    const api = db.prepare('SELECT id FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!api) {
      return res.status(404).json({ error: 'API not found' });
    }

    const metadata = parseSpecMetadata(openapi_spec);
    const version = metadata.version;
    const existing = db.prepare('SELECT id FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, version);
    if (existing) {
      return res.status(409).json({ error: `Version ${version} already exists for this API.` });
    }

    const versionId = `${req.params.id}-${slugifyVersion(version)}`;
    const specFilename = `${versionId}.yaml`;
    const relativeSpecPath = `/openapi/${specFilename}`;
    const absoluteSpecPath = path.join(__dirname, '../openapi', specFilename);
    fs.writeFileSync(absoluteSpecPath, openapi_spec, 'utf8');

    const insertVersion = db.prepare(`
      INSERT INTO api_versions (
        id, api_id, version, openapi_spec_path, spec_sha, endpoints_count,
        openapi_version, status, is_current, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const shouldMakeCurrent = Boolean(make_current);
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
        getSpecSha(openapi_spec),
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
        `audit-${Date.now()}`,
        'API_VERSION_PUBLISHED',
        req.params.id,
        JSON.stringify({ version, make_current: shouldMakeCurrent, endpoints_count: metadata.endpointsCount })
      );
    });

    transaction();
    res.status(201).json({ success: true, versionId, version, is_current: shouldMakeCurrent });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to publish version: ${err.message}` });
  }
});

app.post('/api/catalog/:id/versions/:version/current', (req, res) => {
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
      `).run(`audit-${Date.now()}`, 'API_VERSION_PROMOTED', req.params.id, JSON.stringify({ version: req.params.version }));
    });

    transaction();
    res.json({ success: true, version: req.params.version });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to promote version: ${err.message}` });
  }
});

app.delete('/api/catalog/:id/versions/:version', (req, res) => {
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
    `).run(`audit-${Date.now()}`, 'API_VERSION_DELETED', req.params.id, JSON.stringify({ version: req.params.version }));

    res.json({ success: true, version: req.params.version });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to delete version: ${err.message}` });
  }
});

// Get parsed OpenAPI spec by API ID
app.get('/api/catalog/:id/spec', (req, res) => {
  try {
    const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null;
    const api = requestedVersion
      ? db.prepare('SELECT openapi_spec_path FROM api_versions WHERE api_id = ? AND version = ?').get(req.params.id, requestedVersion) as any
      : db.prepare('SELECT openapi_spec_path FROM apis WHERE id = ?').get(req.params.id) as any;
    if (!api || !api.openapi_spec_path) {
      return res.status(404).json({ error: 'API spec not found' });
    }
    
    const filePath = path.join(__dirname, '..', api.openapi_spec_path);
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

app.post('/api/catalog/validate-spec', async (req, res) => {
  const { specText, specUrl } = req.body;
  try {
    let content = specText || '';
    if (specUrl) {
      const response = await fetch(specUrl);
      if (!response.ok) {
        return res.status(400).json({ valid: false, error: `Failed to fetch spec from URL: ${response.statusText}` });
      }
      content = await response.text();
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ valid: false, error: 'Empty specification content.' });
    }

    let parsed: any;
    try {
      // Try JSON first, fallback to YAML
      parsed = JSON.parse(content);
    } catch {
      try {
        parsed = yaml.load(content);
      } catch (yamlErr: any) {
        return res.status(400).json({ valid: false, error: `Failed to parse YAML/JSON: ${yamlErr.message}` });
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(400).json({ valid: false, error: 'Specification parsed to an invalid object.' });
    }

    const openapiVersion = parsed.openapi || parsed.swagger;
    if (!openapiVersion) {
      return res.status(400).json({ valid: false, error: 'Invalid specification: missing "openapi" or "swagger" version declaration.' });
    }

    const info = parsed.info;
    if (!info || !info.title) {
      return res.status(400).json({ valid: false, error: 'Invalid specification: missing "info.title" metadata.' });
    }

    const paths = parsed.paths || {};
    const endpointsCount = Object.keys(paths).reduce((count, path) => {
      const methods = Object.keys(paths[path]).filter(method => 
        ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())
      );
      return count + methods.length;
    }, 0);

    res.json({
      valid: true,
      metadata: {
        title: info.title,
        version: info.version || '1.0.0',
        description: info.description || '',
        endpointsCount
      },
      rawSpec: content
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ valid: false, error: `Internal validation error: ${err.message}` });
  }
});

app.post('/api/catalog', (req, res) => {
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

  if (!name || !owning_mda_id || !openapi_spec) {
    return res.status(400).json({ error: 'Missing mandatory fields: name, owning_mda_id, and openapi_spec are required.' });
  }

  const id = `api-reg-${crypto.randomUUID()}`;
  const specFilename = `${id}.yaml`;
  const relativeSpecPath = `/openapi/${specFilename}`;
  const absoluteSpecPath = path.join(__dirname, '../openapi', specFilename);

  try {
    const metadata = parseSpecMetadata(openapi_spec);
    // Write OpenAPI file to disk
    fs.writeFileSync(absoluteSpecPath, openapi_spec, 'utf8');

    // Insert into SQLite database
    const stmt = db.prepare(`
      INSERT INTO apis (
        id, name, owning_mda_id, sector, description, lifecycle_status,
        sensitivity_level, sandbox_available, openapi_spec_path, required_approval_level, contact_office,
        technical_owner, personal_data_categories, purpose_limitation, data_minimization_note,
        retention_class, statutory_basis, security_classification, sla_target, compliance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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
      getSpecSha(openapi_spec),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      1,
      'Initial registry version'
    );

    // Log the API registration event in audit log
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (id, event_type, mda_id, api_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);
    const auditId = `audit-${Date.now()}`;
    auditStmt.run(
      auditId,
      'API_REGISTERED',
      owning_mda_id,
      id,
      JSON.stringify({
        api_name: name,
        registered_by_role: 'admin',
        sector,
        sensitivity_level
      })
    );

    res.status(201).json({ success: true, apiId: id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: `Failed to register API: ${err.message}` });
  }
});

// Access Management API
app.use('/api/access', accessRouter);

// --- SANDBOX APIs ---
app.use('/api/v1', sandboxMiddleware);
app.use('/api/v1/identity', identityRouter);
app.use('/api/v1/tax', taxRouter);
app.use('/api/v1/business', businessRouter);
app.use('/api/v1/transport/driving-permit', drivingPermitRouter);
app.use('/api/v1/service-uganda', compositeRouter);

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
