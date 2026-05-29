export function operation(summary: string, description: string, tags: string[]) {
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

export function spec(title: string, description: string, serverBasePath: string, paths: Record<string, unknown>) {
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
