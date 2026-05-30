import { Router, type Response } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { requiredSandboxString } from '../sandbox-input';
import { sandboxDrivingPermitStatus } from '../sandbox-fixtures';

export const drivingPermitRouter = Router();

function sendPermitStatus(permitNumber: string | undefined, res: Response) {
  if (!permitNumber) {
    return sendSandboxError(res, 'MISSING_PERMIT_NUMBER', 'The "permitNumber" path parameter is required.');
  }

  const status = sandboxDrivingPermitStatus(permitNumber);

  if (status === 'SUSPENDED') {
    return res.json({
      status: 'SUSPENDED',
      card_valid_until: '2028-11-20',
      permit_class: 'Group DL'
    });
  }

  if (status === 'EXPIRED') {
    return res.json({
      status: 'EXPIRED',
      card_valid_until: '2024-05-10',
      permit_class: 'Group B'
    });
  }

  if (status === 'ACTIVE') {
    return res.json({
      status: 'ACTIVE',
      card_valid_until: '2029-08-15',
      permit_class: 'Group B'
    });
  }

  return sendSandboxError(res, 'PERMIT_NOT_FOUND', 'The provided driving permit number does not exist.', 404);
}

// GET /api/v1/transport/driving-permit/:permitNumber/status
drivingPermitRouter.get('/:permitNumber/status', (req, res) => {
  return sendPermitStatus(req.params.permitNumber, res);
});

// Compatibility alias for older OpenAPI documents.
drivingPermitRouter.get('/status/:permitNumber', (req, res) => {
  return sendPermitStatus(req.params.permitNumber, res);
});

// POST /api/v1/transport/driving-permit/verify
drivingPermitRouter.post('/verify', (req, res) => {
  const { permit_number: rawPermitNumber } = req.body || {};

  const permitInput = requiredSandboxString(
    rawPermitNumber,
    'permit_number',
    'MISSING_PERMIT_NUMBER',
    'The "permit_number" field is required.',
    'INVALID_PERMIT_NUMBER',
  );
  if (!permitInput.ok) {
    return sendSandboxError(res, permitInput.code, permitInput.message);
  }

  const status = sandboxDrivingPermitStatus(permitInput.value);

  if (status === 'ACTIVE') {
    return res.json({
      verified: true,
      remarks: 'Permit details match successfully.',
      status: 'ACTIVE'
    });
  }

  if (status === 'SUSPENDED') {
    return res.json({
      verified: true,
      remarks: 'Permit details match but the permit is currently suspended.',
      status: 'SUSPENDED'
    });
  }

  return sendSandboxError(res, 'PERMIT_NOT_FOUND', 'The provided driving permit number does not exist.', 404);
});
