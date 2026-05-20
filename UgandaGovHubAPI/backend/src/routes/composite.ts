import { Router } from 'express';
import { sendSandboxError } from '../middleware/sandbox';

export const compositeRouter = Router();

// POST /api/v1/service-uganda/eligibility-check
compositeRouter.post('/eligibility-check', (req, res) => {
  const { nin, tin, permit_number } = req.body;

  if (!nin || !tin) {
    return sendSandboxError(res, 'MISSING_PARAMS', 'Both "nin" and "tin" are required for eligibility checks.');
  }

  // 1. Identity Check Mock
  let identityStatus = 'PARTIAL_MATCH';
  let identityRemarks = 'Name match fuzzy. Review required.';
  let identityEligible = true;

  if (nin === 'CM99021234567X') {
    identityStatus = 'MATCH';
    identityRemarks = 'All provided fields matched the registry.';
  } else if (nin === 'CM00000000000X') {
    identityStatus = 'NO_MATCH';
    identityRemarks = 'NIN not found or details completely mismatched.';
    identityEligible = false;
  }

  // 2. Tax Compliance Mock
  let taxStatus = 'NON_COMPLIANT';
  let taxRemarks = 'Outstanding returns or arrears detected.';
  let taxEligible = false;

  if (tin === '1000123456') {
    taxStatus = 'COMPLIANT';
    taxRemarks = 'Tax clearance is up to date.';
    taxEligible = true;
  }

  // 3. Driving Permit Mock (Optional)
  let permitStatus: string | null = null;
  let permitRemarks: string | null = null;
  let permitEligible = true;

  if (permit_number) {
    const pNum = permit_number.toLowerCase();
    if (pNum.endsWith('susp')) {
      permitStatus = 'SUSPENDED';
      permitRemarks = 'Driving permit is suspended.';
      permitEligible = false;
    } else if (pNum.endsWith('exp')) {
      permitStatus = 'EXPIRED';
      permitRemarks = 'Driving permit is expired.';
      permitEligible = false;
    } else if (pNum === 'wp30219' || pNum.startsWith('wp') || pNum.endsWith('valid')) {
      permitStatus = 'ACTIVE';
      permitRemarks = 'Driving permit is valid.';
    } else {
      permitStatus = 'NOT_FOUND';
      permitRemarks = 'Driving permit number not found.';
      permitEligible = false;
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
