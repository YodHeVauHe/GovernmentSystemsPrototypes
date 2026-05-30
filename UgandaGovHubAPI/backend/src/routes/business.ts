import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { requiredSandboxString } from '../sandbox-input';
import { SANDBOX_FIXTURES, isKnownSandboxBeneficialOwnerNin, isKnownSandboxBusinessRegistration } from '../sandbox-fixtures';

export const businessRouter = Router();

// GET /api/v1/business/registration/:brn
businessRouter.get('/registration/:brn', (req, res) => {
  const { brn } = req.params;

  if (brn === SANDBOX_FIXTURES.business.activeBrn) {
    return res.json({
      status: 'ACTIVE',
      company_name: 'Acme Technologies Uganda Ltd',
      registration_date: '2020-05-10',
      entity_type: 'Private Limited Company'
    });
  }

  if (brn === SANDBOX_FIXTURES.business.dissolvedBrn) {
    return res.json({
      status: 'DISSOLVED',
      company_name: 'Old Kampala Traders',
      registration_date: '2010-01-01',
      entity_type: 'Partnership'
    });
  }

  return sendSandboxError(res, 'BRN_NOT_FOUND', 'The provided Business Registration Number does not exist.', 404);
});

// POST /api/v1/business/beneficial-ownership/verify
businessRouter.post('/beneficial-ownership/verify', (req, res) => {
  const { brn: rawBrn, nin: rawNin } = req.body || {};

  const brnInput = requiredSandboxString(rawBrn, 'brn', 'MISSING_PARAMS', 'Both "brn" and "nin" are required to verify ownership.');
  if (!brnInput.ok) {
    return sendSandboxError(res, brnInput.code, brnInput.message);
  }
  const ninInput = requiredSandboxString(rawNin, 'nin', 'MISSING_PARAMS', 'Both "brn" and "nin" are required to verify ownership.');
  if (!ninInput.ok) {
    return sendSandboxError(res, ninInput.code, ninInput.message);
  }
  const brn = brnInput.value;
  const nin = ninInput.value;

  if (!isKnownSandboxBusinessRegistration(brn)) {
    return sendSandboxError(res, 'BRN_NOT_FOUND', 'The provided Business Registration Number does not exist.', 404);
  }
  if (!isKnownSandboxBeneficialOwnerNin(nin)) {
    return sendSandboxError(res, 'NIN_NOT_FOUND', 'The provided NIN does not exist in the sandbox NIRA registry.', 404);
  }

  if (brn === SANDBOX_FIXTURES.business.activeBrn && nin === SANDBOX_FIXTURES.identity.activeNin) {
    return res.json({
      verified: true,
      ownership_percentage: 51.5,
      role: 'Director'
    });
  }

  return res.json({
    verified: false,
    remarks: 'The specified citizen is not a registered beneficial owner for this business.'
  });
});
