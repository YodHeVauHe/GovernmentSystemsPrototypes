import { Router } from 'express';
import { db } from '../index';
import crypto from 'crypto';
import { logAuditEvent } from '../middleware/sandbox';

export const accessRouter = Router();

// Create an access request (Simulates Developer action)
accessRouter.post('/', (req, res) => {
  const { api_id, consumer_mda_id, purpose, requested_fields, volume_tier, legal_basis, environment } = req.body;
  
  if (!api_id || !consumer_mda_id || !purpose) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = `req-${Date.now()}`;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO access_requests (id, consumer_mda_id, api_id, purpose, status, requested_fields, volume_tier, legal_basis, environment) 
      VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `);
    stmt.run(id, consumer_mda_id, api_id, purpose, requested_fields || null, volume_tier || null, legal_basis || null, environment || 'sandbox');

    // Log the audit event
    logAuditEvent('ACCESS_REQUESTED', consumer_mda_id, api_id, id, {
      purpose,
      requested_fields,
      volume_tier,
      legal_basis,
      environment
    });

    res.json({ id, status: 'PENDING' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// List all access requests (Simulates Admin action)
accessRouter.get('/', (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT r.*, a.name as api_name, m.name as mda_name 
      FROM access_requests r
      JOIN apis a ON r.api_id = a.id
      JOIN mdas m ON r.consumer_mda_id = m.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve an access request (Simulates Admin action)
accessRouter.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const apiKey = `govhub_test_${crypto.randomBytes(12).toString('hex')}`;

  try {
    // Get the request details first for logging
    const requestRecord = db.prepare('SELECT consumer_mda_id, api_id FROM access_requests WHERE id = ?').get(id) as any;
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const stmt = db.prepare(`
      UPDATE access_requests 
      SET status = 'APPROVED', api_key = ? 
      WHERE id = ?
    `);
    stmt.run(apiKey, id);
    
    // Log audit events
    logAuditEvent('ACCESS_APPROVED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      request_id: id
    });
    logAuditEvent('API_KEY_GENERATED', requestRecord.consumer_mda_id, requestRecord.api_id, id, {
      api_key_preview: apiKey.substring(0, 15) + '...'
    });

    res.json({ id, status: 'APPROVED', api_key: apiKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// Post an Audit Log Entry
accessRouter.post('/audit-logs', (req, res) => {
  const { eventType, mdaId, apiId, requestId, details } = req.body;
  try {
    logAuditEvent(eventType, mdaId, apiId, requestId, details);
    res.status(201).json({ status: 'logged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// Get Audit Logs
accessRouter.get('/audit-logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, a.name as api_name, m.short_name as mda_name 
      FROM audit_logs l
      LEFT JOIN apis a ON l.api_id = a.id
      LEFT JOIN mdas m ON l.mda_id = m.id
      ORDER BY l.created_at DESC
    `).all();
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get Access Matrix
accessRouter.get('/matrix', (req, res) => {
  try {
    const permissions = db.prepare(`
      SELECT consumer_mda_id, api_id, status 
      FROM access_requests 
      WHERE status = 'APPROVED'
    `).all();
    res.json(permissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch access matrix' });
  }
});
