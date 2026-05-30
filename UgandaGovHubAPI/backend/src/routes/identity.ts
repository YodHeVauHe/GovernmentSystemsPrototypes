import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { generatePublicId } from '../ids';
import { requiredSandboxString } from '../sandbox-input';

export const identityRouter = Router();

// POST /api/v1/identity/verify-nin
identityRouter.post('/verify-nin', (req, res) => {
  const { nin: rawNin } = req.body || {};

  const ninInput = requiredSandboxString(rawNin, 'nin', 'MISSING_NIN', 'The "nin" field is required.');
  if (!ninInput.ok) {
    return sendSandboxError(res, ninInput.code, ninInput.message);
  }
  const nin = ninInput.value;

  // Deterministic Mock Responses based on NIN
  if (nin === 'CM99021234567X') {
    return res.json({
      status: 'MATCH',
      confidence_score: 1.0,
      remarks: 'All provided fields matched the registry.',
      transaction_id: generatePublicId('tx')
    });
  }

  if (nin === 'CM00000000000X') {
    return res.json({
      status: 'NO_MATCH',
      confidence_score: 0.0,
      remarks: 'NIN not found or details completely mismatched.',
      transaction_id: generatePublicId('tx')
    });
  }

  // Default response
  return res.json({
    status: 'PARTIAL_MATCH',
    confidence_score: 0.75,
    remarks: 'Name match fuzzy. Review required.',
    transaction_id: generatePublicId('tx')
  });
});

// POST /api/v1/identity/status
// Accepts { nin } in the request body to avoid NIN appearing in server access logs and browser history.
// The former GET /api/v1/identity/status/:nin is retained as a deprecated redirect for compatibility.
identityRouter.post('/status', (req, res) => {
  const { nin: rawNin } = req.body || {};

  const ninInput = requiredSandboxString(rawNin, 'nin', 'MISSING_NIN', 'The "nin" field is required.');
  if (!ninInput.ok) {
    return sendSandboxError(res, ninInput.code, ninInput.message);
  }
  const nin = ninInput.value;

  if (nin.endsWith('E')) {
    return res.json({
      status: 'EXPIRED',
      card_valid_until: '2023-12-31'
    });
  }

  if (nin.endsWith('R')) {
    return res.json({
      status: 'REVOKED',
      card_valid_until: '2030-12-31'
    });
  }

  return res.json({
    status: 'ACTIVE',
    card_valid_until: '2034-01-01'
  });
});

// Deprecated: GET /api/v1/identity/status/:nin
// NIN in URL paths leaks to access logs and browser history. Use POST /status instead.
identityRouter.get('/status/:nin', (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/v1/identity/status>; rel="successor-version"');
  const { nin } = req.params;

  if (nin.endsWith('E')) {
    return res.json({ status: 'EXPIRED', card_valid_until: '2023-12-31' });
  }
  if (nin.endsWith('R')) {
    return res.json({ status: 'REVOKED', card_valid_until: '2030-12-31' });
  }
  return res.json({ status: 'ACTIVE', card_valid_until: '2034-01-01' });
});
