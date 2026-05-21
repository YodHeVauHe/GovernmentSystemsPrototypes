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

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
export const db = new Database(path.join(__dirname, '../data/govhub.db'));

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

// Get parsed OpenAPI spec by API ID
app.get('/api/catalog/:id/spec', (req, res) => {
  try {
    const api = db.prepare('SELECT openapi_spec_path FROM apis WHERE id = ?').get(req.params.id) as any;
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
