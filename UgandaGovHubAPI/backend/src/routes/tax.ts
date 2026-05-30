import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { generatePublicId } from '../ids';
import { requiredSandboxString } from '../sandbox-input';
import { sandboxTaxComplianceStatus } from '../sandbox-fixtures';

export const taxRouter = Router();

// POST /api/v1/tax/tin-status
taxRouter.post('/tin-status', (req, res) => {
  const { tin: rawTin } = req.body || {};

  const tinInput = requiredSandboxString(rawTin, 'tin', 'MISSING_TIN', 'The "tin" field is required.');
  if (!tinInput.ok) {
    return sendSandboxError(res, tinInput.code, tinInput.message);
  }
  const tin = tinInput.value;

  const complianceStatus = sandboxTaxComplianceStatus(tin);

  if (complianceStatus === 'COMPLIANT') {
    return res.json({
      status: 'COMPLIANT',
      issuing_authority: 'Uganda Revenue Authority',
      valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      reference_id: generatePublicId('cl')
    });
  }

  if (complianceStatus === 'NON_COMPLIANT') {
    return res.json({
      status: 'NON_COMPLIANT',
      issuing_authority: 'Uganda Revenue Authority',
      remarks: 'Outstanding returns or arrears detected.',
      reference_id: generatePublicId('cl')
    });
  }

  return sendSandboxError(res, 'TIN_NOT_FOUND', 'The provided TIN does not exist in the sandbox URA registry.', 404);
});

// GET /api/v1/tax/clearance/:tin
taxRouter.get('/clearance/:tin', (req, res) => {
  const { tin } = req.params;

  if (sandboxTaxComplianceStatus(tin) !== 'COMPLIANT') {
    return sendSandboxError(res, 'TIN_NOT_FOUND', 'The provided TIN does not exist in the sandbox URA registry.', 404);
  }

  return res.json({
    clearance_status: 'CLEARED',
    issued_date: new Date().toISOString().split('T')[0]
  });
});
