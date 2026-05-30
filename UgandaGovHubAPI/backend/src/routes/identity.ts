import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { generatePublicId } from '../ids';
import { requiredSandboxString } from '../sandbox-input';
import { sandboxIdentityCardStatus, sandboxIdentityVerificationStatus } from '../sandbox-fixtures';

export const identityRouter = Router();

// POST /api/v1/identity/verify-nin
identityRouter.post('/verify-nin', (req, res) => {
  const { nin: rawNin } = req.body || {};

  const ninInput = requiredSandboxString(rawNin, 'nin', 'MISSING_NIN', 'The "nin" field is required.');
  if (!ninInput.ok) {
    return sendSandboxError(res, ninInput.code, ninInput.message);
  }
  const nin = ninInput.value;

  const verificationStatus = sandboxIdentityVerificationStatus(nin);

  if (verificationStatus === 'MATCH') {
    return res.json({
      status: 'MATCH',
      confidence_score: 1.0,
      remarks: 'All provided fields matched the registry.',
      transaction_id: generatePublicId('tx')
    });
  }

  if (verificationStatus === 'NO_MATCH') {
    return res.json({
      status: 'NO_MATCH',
      confidence_score: 0.0,
      remarks: 'NIN not found or details completely mismatched.',
      transaction_id: generatePublicId('tx')
    });
  }

  return sendSandboxError(res, 'NIN_NOT_FOUND', 'The provided NIN does not exist in the sandbox NIRA registry.', 404);
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

  const cardStatus = sandboxIdentityCardStatus(nin);

  if (cardStatus === 'EXPIRED') {
    return res.json({
      status: 'EXPIRED',
      card_valid_until: '2023-12-31'
    });
  }

  if (cardStatus === 'REVOKED') {
    return res.json({
      status: 'REVOKED',
      card_valid_until: '2030-12-31'
    });
  }

  if (cardStatus === 'ACTIVE') {
    return res.json({
      status: 'ACTIVE',
      card_valid_until: '2034-01-01'
    });
  }

  return sendSandboxError(res, 'NIN_NOT_FOUND', 'The provided NIN does not exist in the sandbox NIRA registry.', 404);
});

// Deprecated: GET /api/v1/identity/status/:nin
// NIN in URL paths leaks to access logs and browser history. Use POST /status instead.
identityRouter.get('/status/:nin', (req, res) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/v1/identity/status>; rel="successor-version"');
  const { nin } = req.params;

  const cardStatus = sandboxIdentityCardStatus(nin);

  if (cardStatus === 'EXPIRED') {
    return res.json({ status: 'EXPIRED', card_valid_until: '2023-12-31' });
  }
  if (cardStatus === 'REVOKED') {
    return res.json({ status: 'REVOKED', card_valid_until: '2030-12-31' });
  }
  if (cardStatus === 'ACTIVE') {
    return res.json({ status: 'ACTIVE', card_valid_until: '2034-01-01' });
  }
  return sendSandboxError(res, 'NIN_NOT_FOUND', 'The provided NIN does not exist in the sandbox NIRA registry.', 404);
});
