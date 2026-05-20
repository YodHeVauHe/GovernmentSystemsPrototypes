import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';

export const identityRouter = Router();

// POST /api/v1/identity/verify-nin
identityRouter.post('/verify-nin', (req, res) => {
  const { nin, given_name, surname } = req.body;

  if (!nin) {
    return sendSandboxError(res, 'MISSING_NIN', 'The "nin" field is required.');
  }

  // Deterministic Mock Responses based on NIN
  if (nin === 'CM99021234567X') {
    return res.json({
      status: 'MATCH',
      confidence_score: 1.0,
      remarks: 'All provided fields matched the registry.',
      transaction_id: `tx-${Date.now()}`
    });
  }

  if (nin === 'CM00000000000X') {
    return res.json({
      status: 'NO_MATCH',
      confidence_score: 0.0,
      remarks: 'NIN not found or details completely mismatched.',
      transaction_id: `tx-${Date.now()}`
    });
  }

  // Default response
  return res.json({
    status: 'PARTIAL_MATCH',
    confidence_score: 0.75,
    remarks: 'Name match fuzzy. Review required.',
    transaction_id: `tx-${Date.now()}`
  });
});

// GET /api/v1/identity/status/:nin
identityRouter.get('/status/:nin', (req, res) => {
  const { nin } = req.params;

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
