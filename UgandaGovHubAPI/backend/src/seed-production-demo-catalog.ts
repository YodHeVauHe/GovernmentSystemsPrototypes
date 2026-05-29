import 'dotenv/config';
import yaml from 'js-yaml';
import type { Db } from './db';
import { getSpecSha, parseSpecMetadata, slugifyVersion } from './versioning';

type DemoApi = {
  id: string;
  name: string;
  owning_mda_id: string;
  sector: string;
  description: string;
  lifecycle_status: string;
  sensitivity_level: string;
  required_approval_level: string;
  contact_office: string;
  technical_owner: string;
  personal_data_categories: string;
  purpose_limitation: string;
  data_minimization_note: string;
  retention_class: string;
  statutory_basis: string;
  security_classification: string;
  sla_target: string;
  compliance_status: string;
  docs_visibility: 'public' | 'authenticated' | 'restricted';
  spec: Record<string, unknown>;
};

const mdas = [
  ['mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41', 'National Identification and Registration Authority', 'NIRA'],
  ['mda-ura-2efff0d3-952e-4475-8231-232873a69854', 'Uganda Revenue Authority', 'URA'],
  ['mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5', 'Uganda Registration Services Bureau', 'URSB'],
  ['mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7', 'Ministry of Works and Transport', 'MoWT'],
  ['mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3', 'Ministry of ICT and National Guidance', 'MoICT'],
  ['mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543', 'Ministry of Health', 'MoH'],
  ['mda-ppda-e122702f-76bd-46e0-b15f-2c2b93d9928b', 'Public Procurement and Disposal of Public Assets Authority', 'PPDA'],
  ['mda-nssf-38be9aa8-edb6-453d-ab9e-5d396ca960bc', 'National Social Security Fund', 'NSSF'],
  ['mda-upf-80e53954-69a8-41d0-818d-01372005684e', 'Uganda Police Force', 'UPF'],
  ['mda-nita-u-b47d8923-86ad-47ad-9992-3167c54f0a12', 'National Information Technology Authority Uganda', 'NITA-U'],
];

type LegacyIdMapping = {
  legacyId: string;
  currentId: string;
};

const legacyDemoApiIdMappings: LegacyIdMapping[] = [
  { legacyId: 'api-nira-01', currentId: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6' },
  { legacyId: 'api-ura-01', currentId: 'api-ura-13897843-012d-4951-8b06-374fff183c3e' },
  { legacyId: 'api-ursb-01', currentId: 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65' },
  { legacyId: 'api-mowt-01', currentId: 'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7' },
  { legacyId: 'api-moict-01', currentId: 'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac' },
];

const legacyMdaIdMappings: LegacyIdMapping[] = [
  { legacyId: 'mda-01', currentId: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41' },
  { legacyId: 'mda-02', currentId: 'mda-ura-2efff0d3-952e-4475-8231-232873a69854' },
  { legacyId: 'mda-03', currentId: 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5' },
  { legacyId: 'mda-04', currentId: 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7' },
  { legacyId: 'mda-05', currentId: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3' },
  { legacyId: 'mda-06', currentId: 'mda-moh-50d232f1-d559-4a3c-b922-6b3a7eb70543' },
  { legacyId: 'mda-07', currentId: 'mda-ppda-e122702f-76bd-46e0-b15f-2c2b93d9928b' },
  { legacyId: 'mda-08', currentId: 'mda-nssf-38be9aa8-edb6-453d-ab9e-5d396ca960bc' },
  { legacyId: 'mda-09', currentId: 'mda-upf-80e53954-69a8-41d0-818d-01372005684e' },
  { legacyId: 'mda-10', currentId: 'mda-nita-u-b47d8923-86ad-47ad-9992-3167c54f0a12' },
];

function operation(summary: string, description: string, tags: string[]) {
  return { summary, description, tags };
}

function toOperationId(method: string, route: string, summary: string) {
  const readable = `${method} ${summary} ${route}`
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\/v1\//g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/);
  return readable
    .map((part, index) => {
      const lower = part.charAt(0).toLowerCase() + part.slice(1);
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function sampleForParam(name: string) {
  const samples: Record<string, string> = {
    nin: 'CM99021234567X',
    tin: '1000123456',
    brn: '80010001234567',
    companyNumber: 'C-2024-001245',
    permitNumber: 'DP-UG-2026-001245',
    caseId: 'case-2026-000145',
    bundleId: 'business-startup',
  };
  return samples[name] || `sample-${name}`;
}

function pathParameters(route: string) {
  return [...route.matchAll(/\{([^}]+)\}/g)].map(match => ({
    name: match[1],
    in: 'path',
    required: true,
    description: `Approved sandbox ${match[1]} value. In production use, this identifier is only accepted when the consuming system has an approved purpose, active API key scope, and auditable service transaction reference.`,
    schema: { type: 'string', example: sampleForParam(match[1]) },
  }));
}

function schemaFromExample(example: unknown): Record<string, unknown> {
  if (Array.isArray(example)) {
    return { type: 'array', items: schemaFromExample(example[0] ?? '') };
  }
  if (example && typeof example === 'object') {
    const properties = Object.fromEntries(Object.entries(example).map(([key, value]) => [key, schemaFromExample(value)]));
    return { type: 'object', additionalProperties: false, properties };
  }
  if (typeof example === 'number') return { type: 'number', example };
  if (typeof example === 'boolean') return { type: 'boolean', example };
  return { type: 'string', example };
}

function defaultRequestExample(route: string) {
  const example: Record<string, unknown> = {
    requestId: 'req-demo-2026-0001',
    purpose: 'Approved public service eligibility check',
    consentReference: 'consent-2026-ughub-00451',
  };
  if (route.includes('identity') || route.includes('service-uganda')) example.nin = 'CM99021234567X';
  if (route.includes('tax') || route.includes('service-uganda')) example.tin = '1000123456';
  if (route.includes('business') || route.includes('service-uganda')) example.brn = '80010001234567';
  if (route.includes('transport') || route.includes('service-uganda')) example.permitNumber = 'DP-UG-2026-001245';
  if (route.includes('notification-preferences')) example.channels = ['sms', 'email'];
  if (route.includes('appointment-slots')) example.serviceCenter = 'Kampala One Stop Centre';
  return example;
}

function defaultResponseExample(route: string, summary: string) {
  return {
    requestId: 'req-demo-2026-0001',
    status: 'SUCCESS',
    result: {
      outcome: summary,
      matched: true,
      reference: sampleForParam(route.includes('{tin}') ? 'tin' : route.includes('{nin}') ? 'nin' : 'caseId'),
      issuedAt: '2026-05-28T09:00:00Z',
    },
    audit: {
      correlationId: 'corr-demo-8b2f6a',
      retention: 'Sandbox response generated for demonstration; no source registry record is exposed.',
    },
  };
}

function endpointDoc(route: string, summary: string) {
  const base = {
    requestExample: defaultRequestExample(route),
    responseExample: defaultResponseExample(route, summary),
  };
  const governanceNote = 'Every response includes a correlation identifier for audit review, returns only the minimum data needed for the approved purpose, and avoids exposing full source-system registry records.';

  if (route.includes('/verify-nin')) return {
    notes: `Used by approved public-service workflows to verify that supplied NIN and biographic attributes refer to the same citizen record. ${governanceNote}`,
    requestExample: { nin: 'CM99021234567X', givenName: 'JOHN', surname: 'DOE', dateOfBirth: '1990-01-01', requestId: 'req-nira-verify-0001', purpose: 'Verify applicant identity for a licence service', consentReference: 'consent-nira-2026-00451' },
    responseExample: { status: 'MATCH', confidenceScore: 0.98, matchedFields: ['nin', 'givenName', 'surname', 'dateOfBirth'], transactionId: 'nira-txn-88f9b9a1', registryRecordReturned: false, correlationId: 'corr-nira-verify-00451' },
  };
  if (route.includes('/biographic-match')) return {
    notes: `Supports identity assurance when a consuming service has partial citizen details and needs a confidence score rather than a full registry lookup. ${governanceNote}`,
    requestExample: { givenName: 'SARAH', surname: 'NAKATO', dateOfBirth: '1988-09-14', districtOfBirth: 'Wakiso', requestId: 'req-nira-bio-0002', purpose: 'Resolve duplicate service application' },
    responseExample: { status: 'PARTIAL_MATCH', confidenceScore: 0.82, candidateCount: 1, matchedFields: ['surname', 'dateOfBirth', 'districtOfBirth'], remarks: 'Given name requires manual review.', correlationId: 'corr-nira-bio-0002' },
  };
  if (route.includes('/card-status')) return {
    notes: `Checks whether a national ID card can be accepted for a downstream service without returning the citizen profile. ${governanceNote}`,
    responseExample: { nin: 'CM99021234567X', cardStatus: 'ACTIVE', cardValidUntil: '2030-12-31', replacementInProgress: false, correlationId: 'corr-nira-card-0003' },
  };
  if (route.includes('/death-status')) return {
    notes: `Provides a restricted civil-status signal for fraud prevention and estate-related public workflows. It returns a decision flag only, not civil registry details. ${governanceNote}`,
    responseExample: { nin: 'CM99021234567X', deceased: false, verificationStatus: 'NO_DEATH_RECORD_FLAGGED', checkedAt: '2026-05-28T09:00:00Z', correlationId: 'corr-nira-civil-0004' },
  };
  if (route.includes('/household/confirm')) return {
    notes: `Confirms a declared household relationship for benefit, education, or social-service workflows where the consumer already holds lawful identifiers. ${governanceNote}`,
    requestExample: { primaryNin: 'CM99021234567X', relatedNin: 'CF01021234567Y', relationship: 'DEPENDANT', requestId: 'req-nira-household-0005', purpose: 'Confirm dependant eligibility for a household service' },
    responseExample: { relationshipConfirmed: true, relationship: 'DEPENDANT', confidenceScore: 0.91, manualReviewRequired: false, correlationId: 'corr-nira-household-0005' },
  };
  if (route.includes('/audit-consent')) return {
    notes: `Records the consent reference or statutory basis used before an identity verification call. This lets governance reviewers connect a data access event to the service transaction that justified it. ${governanceNote}`,
    requestExample: { nin: 'CM99021234567X', consentReference: 'consent-nira-2026-00451', capturedBy: 'service-uganda-portal', capturedAt: '2026-05-28T08:55:00Z', purpose: 'Identity verification before licence issuance' },
    responseExample: { consentReference: 'consent-nira-2026-00451', recorded: true, validForPurpose: true, expiresAt: '2026-06-27T08:55:00Z', correlationId: 'corr-nira-consent-0006' },
  };

  if (route.includes('/tin-status')) return {
    notes: `Checks whether a TIN is active and suitable for service onboarding or supplier validation. The endpoint exposes compliance indicators only, not returns, assessments, or arrears schedules. ${governanceNote}`,
    responseExample: { tin: '1000123456', tinStatus: 'ACTIVE', taxpayerType: 'COMPANY', registeredName: 'KAMPALA DEMO TRADERS LTD', complianceStatus: 'COMPLIANT', correlationId: 'corr-ura-tin-0001' },
  };
  if (route.includes('/clearance')) return {
    notes: `Returns the current clearance decision used by procurement, licensing, or business-registration workflows. It does not expose underlying tax history. ${governanceNote}`,
    responseExample: { tin: '1000123456', clearanceStatus: 'CLEARED', validUntil: '2027-05-22', certificateReference: 'TCC-UG-2026-1000123456', issuingAuthority: 'Uganda Revenue Authority', correlationId: 'corr-ura-clearance-0002' },
  };
  if (route.includes('/vat-status')) return {
    notes: `Verifies VAT registration status and effective dates for invoice, procurement, and licensing flows. ${governanceNote}`,
    responseExample: { tin: '1000123456', vatRegistered: true, effectiveDate: '2021-07-01', filingFrequency: 'MONTHLY', status: 'ACTIVE', correlationId: 'corr-ura-vat-0003' },
  };
  if (route.includes('/importer-status')) return {
    notes: `Checks whether a taxpayer is eligible for import-related services based on registration and compliance signals. ${governanceNote}`,
    responseExample: { tin: '1000123456', importerEligible: true, customsAccountStatus: 'ACTIVE', blockedReasons: [], correlationId: 'corr-ura-importer-0004' },
  };
  if (route.includes('/filing-obligations')) return {
    notes: `Lists high-level filing obligation status so a service can guide a taxpayer without exposing submitted returns. ${governanceNote}`,
    responseExample: { tin: '1000123456', obligations: [{ taxHead: 'VAT', period: '2026-04', status: 'FILED' }, { taxHead: 'PAYE', period: '2026-04', status: 'PENDING' }], correlationId: 'corr-ura-filing-0005' },
  };
  if (route.includes('/withholding-exemption')) return {
    notes: `Confirms whether a taxpayer has a current withholding exemption and the validity window for procurement workflows. ${governanceNote}`,
    responseExample: { tin: '1000123456', exempt: true, exemptionNumber: 'WHT-EX-2026-00045', validUntil: '2026-12-31', correlationId: 'corr-ura-wht-0006' },
  };

  if (route.includes('/registration/{brn}')) return {
    notes: `Retrieves public business-registration facts for a known BRN. Restricted filings such as beneficial ownership remain behind separate approved endpoints. ${governanceNote}`,
    responseExample: { brn: '80010001234567', registeredName: 'KAMPALA DEMO TRADERS LTD', registrationDate: '2019-03-18', entityType: 'Private Company Limited by Shares', status: 'ACTIVE', correlationId: 'corr-ursb-reg-0001' },
  };
  if (route.includes('/name-search')) return {
    notes: `Searches registered names for onboarding and due-diligence workflows. Results are intentionally summary-level and should be followed by BRN lookup for authoritative status. ${governanceNote}`,
    responseExample: { query: 'Kampala Demo', results: [{ brn: '80010001234567', registeredName: 'KAMPALA DEMO TRADERS LTD', status: 'ACTIVE' }], resultCount: 1, correlationId: 'corr-ursb-search-0002' },
  };
  if (route.includes('/company-status')) return {
    notes: `Checks the current company lifecycle state used by licensing, procurement, and compliance screening. ${governanceNote}`,
    responseExample: { companyNumber: 'C-2024-001245', status: 'ACTIVE', lastStatusChange: '2024-02-15', restrictions: [], correlationId: 'corr-ursb-status-0003' },
  };
  if (route.includes('/directors')) return {
    notes: `Returns director summary fields for approved KYC and public-service onboarding use cases. Personal identifiers are masked or omitted unless separately approved. ${governanceNote}`,
    responseExample: { brn: '80010001234567', directors: [{ fullName: 'JOHN DOE', nationality: 'UGANDAN', role: 'DIRECTOR', appointmentDate: '2020-01-12' }], restrictedFieldsReturned: false, correlationId: 'corr-ursb-directors-0004' },
  };
  if (route.includes('/beneficial-ownership')) return {
    notes: `Reports whether beneficial ownership filing is present and current. It does not expose beneficial-owner personal details in the default sandbox response. ${governanceNote}`,
    responseExample: { brn: '80010001234567', filingPresent: true, filingCurrent: true, lastFiledAt: '2026-01-31', detailsRequireSeparateApproval: true, correlationId: 'corr-ursb-bo-0005' },
  };
  if (route.includes('/annual-return-status')) return {
    notes: `Checks annual-return filing compliance for registry and procurement workflows. ${governanceNote}`,
    responseExample: { brn: '80010001234567', latestReturnYear: 2025, status: 'FILED', dueDate: '2026-06-30', correlationId: 'corr-ursb-return-0006' },
  };

  if (route.includes('/driving-permit') && route.includes('/status')) return {
    notes: `Verifies whether a driving permit is valid for an approved licensing, enforcement, recruitment, or public-transport workflow. It does not expose full driver history. ${governanceNote}`,
    responseExample: { permitNumber: 'DP-UG-2026-001245', permitStatus: 'ACTIVE', holderVerified: true, validUntil: '2028-04-30', restrictions: [], correlationId: 'corr-mowt-status-0001' },
  };
  if (route.includes('/classes')) return {
    notes: `Lists authorized permit classes and expiry indicators needed to determine whether the holder can operate a vehicle category. ${governanceNote}`,
    responseExample: { permitNumber: 'DP-UG-2026-001245', classes: [{ code: 'B', description: 'Motor car', validUntil: '2028-04-30' }, { code: 'CM', description: 'Medium goods vehicle', validUntil: '2027-11-15' }], correlationId: 'corr-mowt-classes-0002' },
  };
  if (route.includes('/renewal-eligibility')) return {
    notes: `Determines whether a permit can be renewed and identifies non-sensitive blocking reasons for service guidance. ${governanceNote}`,
    responseExample: { permitNumber: 'DP-UG-2026-001245', eligible: true, earliestRenewalDate: '2027-10-30', blockingReasons: [], correlationId: 'corr-mowt-renew-0003' },
  };
  if (route.includes('/medical-validity')) return {
    notes: `Returns the high-level medical-fitness validity signal required for selected transport classes without exposing clinical details. ${governanceNote}`,
    responseExample: { permitNumber: 'DP-UG-2026-001245', medicalFitnessValid: true, validUntil: '2027-05-31', clinicalDetailsReturned: false, correlationId: 'corr-mowt-medical-0004' },
  };
  if (route.includes('/driver-test-results')) return {
    notes: `Checks whether a recent driver-test result supports issuance or upgrade of a permit. Detailed examiner notes are not returned. ${governanceNote}`,
    responseExample: { nin: 'CM99021234567X', latestAttemptDate: '2026-03-12', result: 'PASS', classTested: 'B', eligibleForIssuance: true, correlationId: 'corr-mowt-test-0005' },
  };
  if (route.includes('/psv-eligibility')) return {
    notes: `Combines permit class, validity, and compliance signals to determine public-service-vehicle eligibility for regulated transport workflows. ${governanceNote}`,
    requestExample: { nin: 'CM99021234567X', permitNumber: 'DP-UG-2026-001245', requestedPsvClass: 'OMNIBUS', requestId: 'req-mowt-psv-0006', purpose: 'PSV badge eligibility screening' },
    responseExample: { eligible: true, permitClassAccepted: true, medicalFitnessValid: true, outstandingRestrictions: [], correlationId: 'corr-mowt-psv-0006' },
  };

  if (route.includes('/eligibility/check')) return {
    notes: `Runs the flagship cross-MDA demonstration workflow: identity, tax, business, and permit signals are checked in one auditable transaction. Source systems remain authoritative and GovHub returns only the composed decision. ${governanceNote}`,
    requestExample: { nin: 'CM99021234567X', tin: '1000123456', brn: '80010001234567', permitNumber: 'DP-UG-2026-001245', serviceCode: 'BUSINESS_PSV_LICENCE', requestId: 'req-sug-eligibility-0001', purpose: 'Single-window licence eligibility check' },
    responseExample: { overallDecision: 'ELIGIBLE', checks: [{ source: 'NIRA', status: 'MATCH' }, { source: 'URA', status: 'COMPLIANT' }, { source: 'URSB', status: 'ACTIVE' }, { source: 'MoWT', status: 'VALID' }], nextSteps: ['Generate payment reference', 'Book service appointment'], correlationId: 'corr-sug-eligibility-0001' },
  };
  if (route.includes('/case-status')) return {
    notes: `Returns the orchestration status for a composite service case so consuming portals can show progress without querying every source agency directly. ${governanceNote}`,
    responseExample: { caseId: 'case-2026-000145', status: 'AWAITING_PAYMENT', completedChecks: 4, pendingActions: ['PAYMENT_REFERENCE_CONFIRMATION'], updatedAt: '2026-05-28T09:10:00Z', correlationId: 'corr-sug-case-0002' },
  };
  if (route.includes('/service-bundle')) return {
    notes: `Describes the agencies, checks, documents, and approval steps required for a bundled service. This helps consumers explain why each data source is being accessed. ${governanceNote}`,
    responseExample: { bundleId: 'business-startup', displayName: 'Business Startup Service Bundle', agencies: ['NIRA', 'URA', 'URSB'], checks: ['identityVerification', 'taxCompliance', 'businessRegistration'], requiredDocuments: ['nationalId', 'taxClearance'], correlationId: 'corr-sug-bundle-0003' },
  };
  if (route.includes('/document-checklist')) return {
    notes: `Generates a document checklist based on applicant type and requested service so incomplete cases can be prevented before submission. ${governanceNote}`,
    requestExample: { applicantType: 'COMPANY', serviceCode: 'BUSINESS_PSV_LICENCE', brn: '80010001234567', tin: '1000123456', requestId: 'req-sug-docs-0004' },
    responseExample: { checklist: [{ code: 'TAX_CLEARANCE', required: true, source: 'URA' }, { code: 'BUSINESS_REGISTRATION', required: true, source: 'URSB' }, { code: 'DIRECTOR_ID', required: true, source: 'NIRA' }], correlationId: 'corr-sug-docs-0004' },
  };
  if (route.includes('/appointment-slots')) return {
    notes: `Searches service-centre appointment availability for cases that require in-person verification or document presentation. ${governanceNote}`,
    responseExample: { serviceCenter: 'Kampala One Stop Centre', slots: [{ slotId: 'slot-kla-2026-05-29-0900', startsAt: '2026-05-29T09:00:00+03:00', capacityRemaining: 4 }], correlationId: 'corr-sug-slots-0005' },
  };
  if (route.includes('/payment-reference')) return {
    notes: `Creates a payment reference for approved service fees after eligibility checks have completed. It returns payment metadata only, not card or mobile-money details. ${governanceNote}`,
    requestExample: { caseId: 'case-2026-000145', amount: 125000, currency: 'UGX', serviceCode: 'BUSINESS_PSV_LICENCE', requestId: 'req-sug-pay-0006' },
    responseExample: { paymentReference: 'PRN-2026-000145', amount: 125000, currency: 'UGX', expiresAt: '2026-06-04T09:00:00+03:00', paymentStatus: 'PENDING', correlationId: 'corr-sug-pay-0006' },
  };
  if (route.includes('/notification-preferences')) return {
    notes: `Updates SMS and email preferences for a service case so citizen communication follows the channel selected during the transaction. ${governanceNote}`,
    requestExample: { caseId: 'case-2026-000145', channels: ['sms', 'email'], phoneNumber: '+256700000000', email: 'applicant@example.go.ug', requestId: 'req-sug-notify-0007' },
    responseExample: { caseId: 'case-2026-000145', channels: ['sms', 'email'], updated: true, updatedAt: '2026-05-28T09:15:00Z', correlationId: 'corr-sug-notify-0007' },
  };

  return {
    notes: `Supports an approved GovHub sandbox workflow. ${governanceNote}`,
    ...base,
  };
}

function errorResponse(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/SandboxError' },
        example: {
          error: 'REQUEST_NOT_ALLOWED',
          message: description,
          correlationId: 'corr-demo-8b2f6a',
        },
      },
    },
  };
}

function enrichedOperation(route: string, method: string, rawOperation: Record<string, unknown>) {
  const summary = String(rawOperation.summary || 'Sandbox operation');
  const operationId = toOperationId(method, route, summary);
  const mutatingMethod = ['post', 'put', 'patch'].includes(method);
  const details = endpointDoc(route, summary);
  const operationDescription = `${rawOperation.description}\n\n${details.notes}`;
  return {
    operationId,
    ...rawOperation,
    description: operationDescription,
    parameters: pathParameters(route),
    ...(mutatingMethod ? {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: schemaFromExample(details.requestExample),
            example: details.requestExample,
          },
        },
      },
    } : {}),
    responses: {
      '200': {
        description: `${summary} completed successfully.`,
        content: {
          'application/json': {
            schema: schemaFromExample(details.responseExample),
            example: details.responseExample,
          },
        },
      },
      '400': errorResponse('Invalid request payload or path parameter.'),
      '401': errorResponse('Missing or invalid sandbox API key.'),
      '403': errorResponse('API key is not approved for this endpoint or data scope.'),
      '429': errorResponse('Sandbox rate limit exceeded for this API key.'),
    },
  };
}

function compactRoute(route: string, serverBasePath: string) {
  const visibleBasePath = serverBasePath.replace(/^\/api(?=\/|$)/, '') || serverBasePath;
  if (route === visibleBasePath) return '/';
  if (route.startsWith(`${visibleBasePath}/`)) return route.slice(visibleBasePath.length);
  return route;
}

function enrichPaths(paths: Record<string, unknown>, serverBasePath: string) {
  return Object.fromEntries(Object.entries(paths).map(([route, pathItem]) => [
    compactRoute(route, serverBasePath),
    Object.fromEntries(Object.entries(pathItem as Record<string, Record<string, unknown>>).map(([method, rawOperation]) => [
      method,
      enrichedOperation(route, method.toLowerCase(), rawOperation),
    ])),
  ]));
}

function spec(title: string, description: string, serverBasePath: string, paths: Record<string, unknown>) {
  return {
    openapi: '3.0.3',
    info: {
      title,
      version: '1.1.0',
      description,
      contact: {
        name: 'Uganda GovHub API Support',
        email: 'support@ict.go.ug',
      },
    },
    servers: [
      {
        url: `https://ugandagovhubapi.vercel.app${serverBasePath}`,
        description: 'Production demo sandbox endpoint',
      },
    ],
    security: [{ SandboxApiKey: [] }],
    components: {
      securitySchemes: {
        SandboxApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Scoped sandbox API key issued through the GovHub access request workflow.',
        },
      },
      schemas: {
        SandboxError: {
          type: 'object',
          required: ['error', 'message', 'correlationId'],
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
      },
    },
    paths: enrichPaths(paths, serverBasePath),
  };
}

export const productionDemoApis: DemoApi[] = [
  {
    id: 'api-nira-000c9306-9410-4889-8392-0bb746edbbe6',
    name: 'NIRA Identity Verification API',
    owning_mda_id: 'mda-nira-45b49ebd-8203-4a75-85d5-64925d201f41',
    sector: 'Identity',
    description: 'Verify citizen identity using NIN and consented biographic attributes.',
    lifecycle_status: 'Production',
    sensitivity_level: 'High',
    required_approval_level: 'Director General',
    contact_office: 'data.protection@nira.go.ug',
    technical_owner: 'Identity Systems Team',
    personal_data_categories: 'NIN, surname, given name, date of birth, card status, civil status flags',
    purpose_limitation: 'Identity verification for lawful public service delivery',
    data_minimization_note: 'Returns verification outcomes and match confidence, not full registry records',
    retention_class: 'Access logs retained for 1 year; citizen query payloads are not stored',
    statutory_basis: 'Registration of Persons Act 2015',
    security_classification: 'Restricted',
    sla_target: '99.9% Uptime, <150ms Response Time',
    compliance_status: 'Approved for Production',
    docs_visibility: 'restricted',
    spec: spec('NIRA Identity Verification API', 'Sandbox NIRA-style identity verification endpoints for NIN checks and consented identity assurance.', '/api/v1/identity', {
      '/v1/identity/verify-nin': { post: operation('Verify NIN', 'Checks whether a NIN and biographic fields match a registry record.', ['Identity']) },
      '/v1/identity/biographic-match': { post: operation('Run biographic match', 'Returns a match confidence score for supplied biographic attributes.', ['Identity']) },
      '/v1/identity/card-status/{nin}': { get: operation('Check national ID card status', 'Returns active, expired, replaced, or lost-card sandbox status.', ['Identity']) },
      '/v1/identity/death-status/{nin}': { get: operation('Check civil status flag', 'Returns a restricted yes/no civil status verification result.', ['Identity']) },
      '/v1/identity/household/confirm': { post: operation('Confirm household relationship', 'Confirms whether supplied identifiers are linked in a household relationship.', ['Identity']) },
      '/v1/identity/audit-consent': { post: operation('Record consent receipt', 'Records a consent reference for downstream verification workflows.', ['Governance']) },
    }),
  },
  {
    id: 'api-ura-13897843-012d-4951-8b06-374fff183c3e',
    name: 'URA Tax Compliance Status API',
    owning_mda_id: 'mda-ura-2efff0d3-952e-4475-8231-232873a69854',
    sector: 'Finance',
    description: 'Check taxpayer compliance, clearance, VAT, and filing status for service eligibility workflows.',
    lifecycle_status: 'Production',
    sensitivity_level: 'Medium',
    required_approval_level: 'Commissioner General',
    contact_office: 'api.support@ura.go.ug',
    technical_owner: 'URA IT Department',
    personal_data_categories: 'TIN, compliance status, VAT status, filing obligation indicators',
    purpose_limitation: 'Supplier verification, licensing, business registration, and compliance tracking',
    data_minimization_note: 'Returns compliance indicators only; no tax returns or assessment details',
    retention_class: 'Logs kept for 6 months',
    statutory_basis: 'Tax Procedures Code Act 2014',
    security_classification: 'Official',
    sla_target: '99.5% Uptime, <200ms Response Time',
    compliance_status: 'Approved for Production',
    docs_visibility: 'authenticated',
    spec: spec('URA Tax Compliance Status API', 'Sandbox URA-style tax verification endpoints for TIN and compliance checks.', '/api/v1/tax', {
      '/v1/tax/tin-status/{tin}': { get: operation('Check TIN status', 'Returns active, inactive, suspended, or unknown sandbox TIN status.', ['Tax']) },
      '/v1/tax/clearance/{tin}': { get: operation('Check tax clearance', 'Returns whether a taxpayer has a valid clearance indicator.', ['Tax']) },
      '/v1/tax/vat-status/{tin}': { get: operation('Check VAT registration', 'Returns VAT registration and effective date indicators.', ['Tax']) },
      '/v1/tax/importer-status/{tin}': { get: operation('Check importer eligibility', 'Returns whether the taxpayer is eligible for import-related services.', ['Trade']) },
      '/v1/tax/filing-obligations/{tin}': { get: operation('List filing obligations', 'Returns high-level filing obligation status without exposing returns.', ['Tax']) },
      '/v1/tax/withholding-exemption/{tin}': { get: operation('Check withholding exemption', 'Returns current withholding exemption eligibility status.', ['Tax']) },
    }),
  },
  {
    id: 'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65',
    name: 'URSB Business Registration Lookup',
    owning_mda_id: 'mda-ursb-94540e99-0027-4cd7-86ca-664d3776c4f5',
    sector: 'Commerce',
    description: 'Look up business registration, company status, directors, and filing compliance signals.',
    lifecycle_status: 'Beta',
    sensitivity_level: 'Low',
    required_approval_level: 'Registrar General',
    contact_office: 'services@ursb.go.ug',
    technical_owner: 'URSB Systems Division',
    personal_data_categories: 'BRN, company name, registration status, director names, beneficial ownership indicators',
    purpose_limitation: 'KYC verification for government registration and approved service onboarding',
    data_minimization_note: 'Separates public registry facts from restricted beneficial ownership indicators',
    retention_class: 'Logs kept for 1 year',
    statutory_basis: 'Companies Act 2012',
    security_classification: 'Public',
    sla_target: '99.0% Uptime, <300ms Response Time',
    compliance_status: 'Approved for Sandbox',
    docs_visibility: 'public',
    spec: spec('URSB Business Registration Lookup', 'Sandbox URSB-style business registry endpoints for registration and company status checks.', '/api/v1/business', {
      '/v1/business/registration/{brn}': { get: operation('Get registration record', 'Returns public business registration facts for a BRN.', ['Business Registry']) },
      '/v1/business/name-search': { get: operation('Search registered names', 'Searches sandbox company and business names.', ['Business Registry']) },
      '/v1/business/company-status/{companyNumber}': { get: operation('Check company status', 'Returns active, dormant, dissolved, or under-review status.', ['Business Registry']) },
      '/v1/business/directors/{brn}': { get: operation('List director summary', 'Returns director summary fields for approved registry use cases.', ['Business Registry']) },
      '/v1/business/beneficial-ownership/{brn}': { get: operation('Check beneficial ownership filing', 'Returns whether beneficial ownership filing is present and current.', ['Compliance']) },
      '/v1/business/annual-return-status/{brn}': { get: operation('Check annual return status', 'Returns annual return filing compliance indicator.', ['Compliance']) },
    }),
  },
  {
    id: 'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7',
    name: 'Driving Permit Verification API',
    owning_mda_id: 'mda-mowt-800aedbd-9c89-4df5-91d8-4250120003c7',
    sector: 'Transport',
    description: 'Verify driving permit status, classes, renewal eligibility, and professional driver indicators.',
    lifecycle_status: 'Beta',
    sensitivity_level: 'Medium',
    required_approval_level: 'Director of Transport',
    contact_office: 'permits.support@works.go.ug',
    technical_owner: 'MoWT IT Team',
    personal_data_categories: 'Permit number, class, expiry, validity status, eligibility indicators',
    purpose_limitation: 'Driver eligibility checks for recruitment, licensing, enforcement, and service delivery',
    data_minimization_note: 'Returns validity and class authorization; does not expose full driving history',
    retention_class: 'Logs kept for 6 months',
    statutory_basis: 'Traffic and Road Safety Act 1998',
    security_classification: 'Official',
    sla_target: '99.5% Uptime, <200ms Response Time',
    compliance_status: 'Under Review',
    docs_visibility: 'authenticated',
    spec: spec('Driving Permit Verification API', 'Sandbox Ministry of Works and Transport-style driving permit verification endpoints.', '/api/v1/transport', {
      '/v1/transport/driving-permit/{permitNumber}/status': { get: operation('Check permit status', 'Returns active, expired, suspended, or revoked sandbox permit status.', ['Transport']) },
      '/v1/transport/driving-permit/{permitNumber}/classes': { get: operation('List permit classes', 'Returns authorized driving classes and expiry indicators.', ['Transport']) },
      '/v1/transport/driving-permit/{permitNumber}/renewal-eligibility': { get: operation('Check renewal eligibility', 'Returns renewal eligibility and blocking reason indicators.', ['Transport']) },
      '/v1/transport/driving-permit/{permitNumber}/medical-validity': { get: operation('Check medical validity', 'Returns high-level medical fitness validity for relevant classes.', ['Transport']) },
      '/v1/transport/driver-test-results/{nin}': { get: operation('Check driver test result', 'Returns pass/fail eligibility for a recent driver test attempt.', ['Transport']) },
      '/v1/transport/psv-eligibility': { post: operation('Check PSV eligibility', 'Combines permit class and compliance signals for PSV eligibility.', ['Transport']) },
    }),
  },
  {
    id: 'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac',
    name: 'Service Uganda Composite Eligibility',
    owning_mda_id: 'mda-moict-1adc5ae5-f0f3-4121-bbc8-825065ec8fd3',
    sector: 'Integration',
    description: 'Composite workflow checking identity, tax, business, permit, appointment, and payment readiness.',
    lifecycle_status: 'Draft',
    sensitivity_level: 'High',
    required_approval_level: 'Permanent Secretary',
    contact_office: 'support@ict.go.ug',
    technical_owner: 'GovHub Integration Team',
    personal_data_categories: 'NIN, TIN, permit number, BRN, service request references',
    purpose_limitation: 'Single-window eligibility assessment for bundled public services',
    data_minimization_note: 'Aggregates source status without consolidating or storing citizen records',
    retention_class: 'Correlation log kept for 30 days',
    statutory_basis: 'National ICT Policy 2014',
    security_classification: 'Restricted',
    sla_target: '99.0% Uptime, <800ms Response Time',
    compliance_status: 'Draft',
    docs_visibility: 'restricted',
    spec: spec('Service Uganda Composite Eligibility', 'Sandbox composite service endpoints for cross-MDA eligibility and service orchestration demos.', '/api/v1/service-uganda', {
      '/v1/service-uganda/eligibility/check': { post: operation('Run composite eligibility check', 'Checks identity, tax, business, and permit signals in one workflow.', ['Composite Services']) },
      '/v1/service-uganda/case-status/{caseId}': { get: operation('Get case status', 'Returns current status for a composite service request.', ['Composite Services']) },
      '/v1/service-uganda/service-bundle/{bundleId}': { get: operation('Get service bundle requirements', 'Returns agencies, checks, and required documents for a bundled service.', ['Composite Services']) },
      '/v1/service-uganda/document-checklist': { post: operation('Generate document checklist', 'Generates a checklist based on applicant type and requested service.', ['Composite Services']) },
      '/v1/service-uganda/appointment-slots': { get: operation('Search appointment slots', 'Returns sandbox appointment slots for one-stop service centers.', ['Composite Services']) },
      '/v1/service-uganda/payment-reference': { post: operation('Create payment reference', 'Creates a mock payment reference for service fee collection.', ['Composite Services']) },
      '/v1/service-uganda/notification-preferences': { patch: operation('Update notification preferences', 'Updates SMS/email notification preferences for a service case.', ['Composite Services']) },
    }),
  },
];

type SyncProductionDemoCatalogOptions = {
  log?: boolean;
};

async function cleanupLegacyProductionDemoRows(db: Db) {
  for (const { legacyId, currentId } of legacyDemoApiIdMappings) {
    await db.prepare('UPDATE access_requests SET api_id = ? WHERE api_id = ?').run(currentId, legacyId);
    await db.prepare('UPDATE audit_logs SET api_id = ? WHERE api_id = ?').run(currentId, legacyId);
    await db.prepare('DELETE FROM api_versions WHERE api_id = ?').run(legacyId);
    await db.prepare('DELETE FROM apis WHERE id = ?').run(legacyId);
  }

  for (const { legacyId, currentId } of legacyMdaIdMappings) {
    await db.prepare('UPDATE apis SET owning_mda_id = ? WHERE owning_mda_id = ?').run(currentId, legacyId);
    await db.prepare('UPDATE access_requests SET consumer_mda_id = ? WHERE consumer_mda_id = ?').run(currentId, legacyId);
    await db.prepare('UPDATE audit_logs SET mda_id = ? WHERE mda_id = ?').run(currentId, legacyId);
    await db.prepare('UPDATE users SET mda_id = ? WHERE mda_id = ?').run(currentId, legacyId);
    await db.prepare('UPDATE users SET requested_mda_id = ? WHERE requested_mda_id = ?').run(currentId, legacyId);
    await db.prepare('DELETE FROM mdas WHERE id = ?').run(legacyId);
  }
}

export async function syncProductionDemoCatalog(db: Db, options: SyncProductionDemoCatalogOptions = {}) {
  const insertMda = db.prepare(`
    INSERT INTO mdas (id, name, short_name)
    VALUES (?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      short_name = EXCLUDED.short_name
  `);
  for (const mda of mdas) await insertMda.run(...mda);

  const upsertApi = db.prepare(`
    INSERT INTO apis (
      id, name, owning_mda_id, sector, description, lifecycle_status,
      sensitivity_level, sandbox_available, openapi_spec_path, openapi_spec_text,
      required_approval_level, contact_office, technical_owner, personal_data_categories,
      purpose_limitation, data_minimization_note, retention_class, statutory_basis,
      security_classification, sla_target, compliance_status, docs_visibility
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      owning_mda_id = EXCLUDED.owning_mda_id,
      sector = EXCLUDED.sector,
      description = EXCLUDED.description,
      lifecycle_status = EXCLUDED.lifecycle_status,
      sensitivity_level = EXCLUDED.sensitivity_level,
      sandbox_available = EXCLUDED.sandbox_available,
      openapi_spec_path = EXCLUDED.openapi_spec_path,
      openapi_spec_text = EXCLUDED.openapi_spec_text,
      required_approval_level = EXCLUDED.required_approval_level,
      contact_office = EXCLUDED.contact_office,
      technical_owner = EXCLUDED.technical_owner,
      personal_data_categories = EXCLUDED.personal_data_categories,
      purpose_limitation = EXCLUDED.purpose_limitation,
      data_minimization_note = EXCLUDED.data_minimization_note,
      retention_class = EXCLUDED.retention_class,
      statutory_basis = EXCLUDED.statutory_basis,
      security_classification = EXCLUDED.security_classification,
      sla_target = EXCLUDED.sla_target,
      compliance_status = EXCLUDED.compliance_status,
      docs_visibility = EXCLUDED.docs_visibility
  `);

  const upsertVersion = db.prepare(`
    INSERT INTO api_versions (
      id, api_id, version, openapi_spec_path, openapi_spec_text, spec_sha,
      endpoints_count, openapi_version, status, is_current, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (api_id, version) DO UPDATE SET
      openapi_spec_path = EXCLUDED.openapi_spec_path,
      openapi_spec_text = EXCLUDED.openapi_spec_text,
      spec_sha = EXCLUDED.spec_sha,
      endpoints_count = EXCLUDED.endpoints_count,
      openapi_version = EXCLUDED.openapi_version,
      status = EXCLUDED.status,
      is_current = EXCLUDED.is_current,
      notes = EXCLUDED.notes
  `);

  for (const api of productionDemoApis) {
    const specText = yaml.dump(api.spec, { lineWidth: 120, noRefs: true });
    const metadata = parseSpecMetadata(specText);
    const openapiPath = `/openapi/${api.id}-${slugifyVersion(metadata.version)}.yaml`;
    const versionId = `${api.id}-${slugifyVersion(metadata.version)}`;

    await upsertApi.run(
      api.id,
      api.name,
      api.owning_mda_id,
      api.sector,
      api.description,
      api.lifecycle_status,
      api.sensitivity_level,
      true,
      openapiPath,
      specText,
      api.required_approval_level,
      api.contact_office,
      api.technical_owner,
      api.personal_data_categories,
      api.purpose_limitation,
      api.data_minimization_note,
      api.retention_class,
      api.statutory_basis,
      api.security_classification,
      api.sla_target,
      api.compliance_status,
      api.docs_visibility
    );

    await db.prepare('UPDATE api_versions SET is_current = FALSE WHERE api_id = ?').run(api.id);
    await upsertVersion.run(
      versionId,
      api.id,
      metadata.version,
      openapiPath,
      specText,
      getSpecSha(specText),
      metadata.endpointsCount,
      metadata.openapiVersion,
      'Published',
      true,
      'Expanded production demo catalog seed'
    );
  }

  await cleanupLegacyProductionDemoRows(db);

  const rows = await db.prepare(`
    SELECT a.id, a.name, v.endpoints_count
    FROM apis a
    LEFT JOIN api_versions v ON v.api_id = a.id AND v.is_current = TRUE
    WHERE a.id = ANY(?)
    ORDER BY a.name
  `).all(productionDemoApis.map(api => api.id));

  if (options.log) console.table(rows);
}

async function upsertDemoCatalog() {
  process.env.GOVHUB_SYNC_DEMO_CATALOG = 'false';
  const { db, initializeApp } = await import('./app');
  await initializeApp();
  await syncProductionDemoCatalog(db, { log: true });
  await db.close();
}

if (require.main === module) {
  upsertDemoCatalog().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
