import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { generatePublicId } from '../ids';

export const taxRouter = Router();

// POST /api/v1/tax/tin-status
taxRouter.post('/tin-status', (req, res) => {
  const { tin } = req.body;

  if (!tin) {
    return sendSandboxError(res, 'MISSING_TIN', 'The "tin" field is required.');
  }

  if (tin === '1000123456') {
    return res.json({
      status: 'COMPLIANT',
      issuing_authority: 'Uganda Revenue Authority',
      valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      reference_id: generatePublicId('cl')
    });
  }

  return res.json({
    status: 'NON_COMPLIANT',
    issuing_authority: 'Uganda Revenue Authority',
    remarks: 'Outstanding returns or arrears detected.',
    reference_id: generatePublicId('cl')
  });
});

// GET /api/v1/tax/clearance/:tin
taxRouter.get('/clearance/:tin', (req, res) => {
  const { tin } = req.params;

  if (tin.startsWith('9')) {
    return sendSandboxError(res, 'INVALID_TIN', 'TIN format is unrecognized.', 404);
  }

  return res.json({
    clearance_status: 'CLEARED',
    issued_date: new Date().toISOString().split('T')[0]
  });
});
