import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';
import { optionalSandboxString, requiredSandboxString } from '../sandbox-input';
import { sandboxDrivingPermitStatus, sandboxIdentityVerificationStatus, sandboxTaxComplianceStatus } from '../sandbox-fixtures';

export const compositeRouter = Router();

// POST /api/v1/service-uganda/eligibility-check
compositeRouter.post('/eligibility-check', (req, res) => {
  const { nin: rawNin, tin: rawTin, permit_number: rawPermitNumber } = req.body || {};

  const ninInput = requiredSandboxString(rawNin, 'nin', 'MISSING_PARAMS', 'Both "nin" and "tin" are required for eligibility checks.');
  if (!ninInput.ok) {
    return sendSandboxError(res, ninInput.code, ninInput.message);
  }
  const tinInput = requiredSandboxString(rawTin, 'tin', 'MISSING_PARAMS', 'Both "nin" and "tin" are required for eligibility checks.');
  if (!tinInput.ok) {
    return sendSandboxError(res, tinInput.code, tinInput.message);
  }
  const permitInput = optionalSandboxString(rawPermitNumber, 'permit_number', 'INVALID_PERMIT_NUMBER');
  if (!permitInput.ok) {
    return sendSandboxError(res, permitInput.code, permitInput.message);
  }
  const nin = ninInput.value;
  const tin = tinInput.value;
  const permitNumber = permitInput.value;

  // 1. Identity Check Mock
  let identityStatus = '';
  let identityRemarks = '';
  let identityEligible = false;

  const identityVerificationStatus = sandboxIdentityVerificationStatus(nin);

  if (identityVerificationStatus === 'MATCH') {
    identityStatus = 'MATCH';
    identityRemarks = 'All provided fields matched the registry.';
    identityEligible = true;
  } else if (identityVerificationStatus === 'NO_MATCH') {
    identityStatus = 'NO_MATCH';
    identityRemarks = 'NIN not found or details completely mismatched.';
  } else {
    return sendSandboxError(res, 'NIN_NOT_FOUND', 'The provided NIN does not exist in the sandbox NIRA registry.', 404);
  }

  // 2. Tax Compliance Mock
  let taxStatus = 'NON_COMPLIANT';
  let taxRemarks = 'Outstanding returns or arrears detected.';
  let taxEligible = false;

  const complianceStatus = sandboxTaxComplianceStatus(tin);

  if (complianceStatus === 'COMPLIANT') {
    taxStatus = 'COMPLIANT';
    taxRemarks = 'Tax clearance is up to date.';
    taxEligible = true;
  } else if (complianceStatus !== 'NON_COMPLIANT') {
    return sendSandboxError(res, 'TIN_NOT_FOUND', 'The provided TIN does not exist in the sandbox URA registry.', 404);
  }

  // 3. Driving Permit Mock (Optional)
  let permitStatus: string | null = null;
  let permitRemarks: string | null = null;
  let permitEligible = true;

  if (permitNumber) {
    const drivingPermitStatus = sandboxDrivingPermitStatus(permitNumber);
    if (drivingPermitStatus === 'SUSPENDED') {
      permitStatus = 'SUSPENDED';
      permitRemarks = 'Driving permit is suspended.';
      permitEligible = false;
    } else if (drivingPermitStatus === 'EXPIRED') {
      permitStatus = 'EXPIRED';
      permitRemarks = 'Driving permit is expired.';
      permitEligible = false;
    } else if (drivingPermitStatus === 'ACTIVE') {
      permitStatus = 'ACTIVE';
      permitRemarks = 'Driving permit is valid.';
    } else {
      return sendSandboxError(res, 'PERMIT_NOT_FOUND', 'The provided driving permit number does not exist.', 404);
    }
  }

  const overallEligible = identityEligible && taxEligible && permitEligible;

  const details: any = {
    identity: {
      status: identityStatus,
      remarks: identityRemarks,
      source: 'NIRA'
    },
    tax: {
      status: taxStatus,
      remarks: taxRemarks,
      source: 'URA'
    }
  };

  if (permitStatus) {
    details.permit = {
      status: permitStatus,
      remarks: permitRemarks,
      source: 'MoWT'
    };
  }

  return res.json({
    overall_eligible: overallEligible,
    details
  });
});
