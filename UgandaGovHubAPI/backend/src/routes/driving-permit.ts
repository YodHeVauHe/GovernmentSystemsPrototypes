import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';

export const drivingPermitRouter = Router();

// GET /api/v1/transport/driving-permit/status/:permitNumber
drivingPermitRouter.get('/status/:permitNumber', (req, res) => {
  const { permitNumber } = req.params;

  if (!permitNumber) {
    return sendSandboxError(res, 'MISSING_PERMIT_NUMBER', 'The "permitNumber" path parameter is required.');
  }

  const pNum = permitNumber.toLowerCase();

  if (pNum.endsWith('susp')) {
    return res.json({
      status: 'SUSPENDED',
      card_valid_until: '2028-11-20',
      permit_class: 'Group DL'
    });
  }

  if (pNum.endsWith('exp')) {
    return res.json({
      status: 'EXPIRED',
      card_valid_until: '2024-05-10',
      permit_class: 'Group B'
    });
  }

  if (pNum === 'wp30219' || pNum.endsWith('valid') || pNum.startsWith('wp')) {
    return res.json({
      status: 'ACTIVE',
      card_valid_until: '2029-08-15',
      permit_class: 'Group B'
    });
  }

  return sendSandboxError(res, 'PERMIT_NOT_FOUND', 'The provided driving permit number does not exist.', 404);
});

// POST /api/v1/transport/driving-permit/verify
drivingPermitRouter.post('/verify', (req, res) => {
  const { permit_number, surname, class: permitClass } = req.body;

  if (!permit_number) {
    return sendSandboxError(res, 'MISSING_PERMIT_NUMBER', 'The "permit_number" field is required.');
  }

  const pNum = permit_number.toLowerCase();

  if (pNum === 'wp30219' || pNum.endsWith('valid') || pNum.startsWith('wp')) {
    return res.json({
      verified: true,
      remarks: 'Permit details match successfully.',
      status: 'ACTIVE'
    });
  }

  if (pNum.endsWith('susp')) {
    return res.json({
      verified: true,
      remarks: 'Permit details match but the permit is currently suspended.',
      status: 'SUSPENDED'
    });
  }

  return res.json({
    verified: false,
    remarks: 'The specified driving permit number was not found or details mismatched.',
    status: 'NOT_FOUND'
  });
});
