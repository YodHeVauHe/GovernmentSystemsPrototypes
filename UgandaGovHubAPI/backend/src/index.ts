import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
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
