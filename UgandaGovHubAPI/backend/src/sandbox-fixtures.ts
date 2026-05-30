export const SANDBOX_FIXTURES = {
  identity: {
    activeNin: 'CM99021234567X',
    noMatchNin: 'CM00000000000X',
    expiredNin: 'CM99021234567E',
    revokedNin: 'CM99021234567R',
  },
  tax: {
    compliantTin: '1000123456',
    nonCompliantTin: '9999999999',
  },
  business: {
    activeBrn: 'BRN12345',
    dissolvedBrn: 'BRN00000',
  },
  drivingPermit: {
    activePermit: 'WP30219',
    suspendedPermit: 'WP30219susp',
    expiredPermit: 'WP30219exp',
  },
} as const;

export function matchesSandboxFixture(input: string, fixture: string) {
  return input.toLowerCase() === fixture.toLowerCase();
}

export function sandboxDrivingPermitStatus(permitNumber: string) {
  const permit = SANDBOX_FIXTURES.drivingPermit;
  if (matchesSandboxFixture(permitNumber, permit.activePermit)) return 'ACTIVE';
  if (matchesSandboxFixture(permitNumber, permit.suspendedPermit)) return 'SUSPENDED';
  if (matchesSandboxFixture(permitNumber, permit.expiredPermit)) return 'EXPIRED';
  return null;
}

export function sandboxIdentityVerificationStatus(nin: string) {
  if (nin === SANDBOX_FIXTURES.identity.activeNin) return 'MATCH';
  if (nin === SANDBOX_FIXTURES.identity.noMatchNin) return 'NO_MATCH';
  return null;
}

export function sandboxIdentityCardStatus(nin: string) {
  if (nin === SANDBOX_FIXTURES.identity.activeNin) return 'ACTIVE';
  if (nin === SANDBOX_FIXTURES.identity.expiredNin) return 'EXPIRED';
  if (nin === SANDBOX_FIXTURES.identity.revokedNin) return 'REVOKED';
  return null;
}

export function sandboxTaxComplianceStatus(tin: string) {
  if (tin === SANDBOX_FIXTURES.tax.compliantTin) return 'COMPLIANT';
  if (tin === SANDBOX_FIXTURES.tax.nonCompliantTin) return 'NON_COMPLIANT';
  return null;
}

export function isKnownSandboxBusinessRegistration(brn: string) {
  return brn === SANDBOX_FIXTURES.business.activeBrn || brn === SANDBOX_FIXTURES.business.dissolvedBrn;
}

export function isKnownSandboxBeneficialOwnerNin(nin: string) {
  return nin === SANDBOX_FIXTURES.identity.activeNin || nin === SANDBOX_FIXTURES.identity.noMatchNin;
}
