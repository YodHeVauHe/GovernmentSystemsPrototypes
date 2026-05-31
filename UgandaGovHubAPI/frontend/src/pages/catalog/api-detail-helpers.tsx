import { API_BASE } from '@/lib/api-base';
import { resolveOpenApiSchema, schemaExample as openApiSchemaExample } from '@/lib/openapi-examples';

export type SandboxParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export type ApiVersion = {
  id: string;
  api_id: string;
  version: string;
  openapi_spec_path: string;
  spec_sha: string;
  endpoints_count: number;
  openapi_version: string;
  status: string;
  is_current: boolean;
  sync_status: 'current' | 'available';
  created_at: string;
};

export type SandboxParameterRow = {
  key: string;
  name: string;
  in: SandboxParameterLocation;
  required?: boolean;
  description?: string;
  schema?: any;
  value: string;
  enabled: boolean;
};

export const sampleValues: Record<string, string> = {
  nin: 'CM99021234567X',
  given_name: 'JOHN',
  surname: 'DOE',
  date_of_birth: '1990-01-01',
  tin: '1000123456',
  brn: '80010001234567',
  companyNumber: 'C-2024-001245',
  permitNumber: 'WP30219',
  permit_number: 'WP30219',
  caseId: 'case-2026-000145',
  bundleId: 'business-startup',
  class: 'Group B',
};

const apiBasePathById: Record<string, string> = {
  'api-nira-000c9306-9410-4889-8392-0bb746edbbe6': '/api/v1/identity',
  'api-ura-13897843-012d-4951-8b06-374fff183c3e': '/api/v1/tax',
  'api-ursb-a75f163c-5df8-4c95-92aa-c21e86502b65': '/api/v1/business',
  'api-mowt-817fd255-079c-44ba-a338-e95d510f56b7': '/api/v1/transport/driving-permit',
  'api-moict-d0de33dc-0e3f-449b-8b9d-6608847cb6ac': '/api/v1/service-uganda',
};

export function getSchemaDefault(schema: any, name: string): any {
  if (!schema) return sampleValues[name] || '';
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];
  if (sampleValues[name] !== undefined) return sampleValues[name];
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  return '';
}

export function buildBodyExample(requestBody: any, spec?: any) {
  const content = requestBody?.content || {};
  const contentType = Object.keys(content)[0] || 'application/json';
  const media = content[contentType];

  if (media?.example !== undefined) {
    return { contentType, value: media.example };
  }

  const firstExample = media?.examples ? Object.values(media.examples)[0] as any : null;
  if (firstExample?.value !== undefined) {
    return { contentType, value: firstExample.value };
  }

  const schema = spec ? resolveOpenApiSchema(media?.schema, spec) : media?.schema;
  if (schema?.type === 'object' || schema?.properties) {
    const value = Object.fromEntries(
      Object.entries(schema.properties || {}).map(([name, propertySchema]) => [
        name,
        spec ? schemaExample(propertySchema, spec, name) : getSchemaDefault(propertySchema, name),
      ])
    );
    return { contentType, value };
  }

  return { contentType, value: '' };
}

const catalogSchemaExampleOptions = {
  sampleValues,
  stringFallback: '',
  booleanFallback: false,
  numberFallback: 0,
  integerFallback: 0,
};

function schemaExample(schema: any, spec: any, name = 'value'): any {
  return openApiSchemaExample(schema, spec, name, catalogSchemaExampleOptions) ?? sampleValues[name] ?? '';
}

export function bodyFields(requestBody: any, spec: any) {
  const content = requestBody?.content || {};
  const media = content['application/json'] || content[Object.keys(content)[0]];
  const schema = resolveOpenApiSchema(media?.schema, spec);
  return Object.entries(schema?.properties || {}).map(([name, fieldSchema]: [string, any]) => {
    const resolvedField = resolveOpenApiSchema(fieldSchema, spec);
    return {
      name,
      required: schema?.required?.includes(name),
      description: resolvedField?.description,
      type: resolvedField?.type || (resolvedField?.properties ? 'object' : 'string'),
    };
  });
}

function fallbackResponseExample(ep: any, status: string) {
  const success = status.startsWith('2');
  const path = String(ep.path || '');
  const summary = String(ep.data.summary || '').toLowerCase();
  const target = `${path} ${summary}`.toLowerCase();

  if (!success) {
    return {
      error: status === '401' ? 'MISSING_API_KEY' : status === '403' ? 'ACCESS_NOT_APPROVED' : 'REQUEST_NOT_ALLOWED',
      message: ep.data.responses?.[status]?.description || 'The request could not be completed.',
      correlationId: 'corr-demo-8b2f6a',
    };
  }

  if (target.includes('verify-nin')) {
    return {
      status: 'MATCH',
      confidenceScore: 0.98,
      matchedFields: ['nin', 'givenName', 'surname', 'dateOfBirth'],
      transactionId: 'nira-txn-88f9b9a1',
      registryRecordReturned: false,
      correlationId: 'corr-nira-verify-00451',
    };
  }
  if (target.includes('biographic-match')) {
    return {
      status: 'PARTIAL_MATCH',
      confidenceScore: 0.82,
      candidateCount: 1,
      matchedFields: ['surname', 'dateOfBirth', 'districtOfBirth'],
      remarks: 'Given name requires manual review.',
      correlationId: 'corr-nira-bio-0002',
    };
  }
  if (target.includes('card-status')) {
    return {
      nin: sampleValues.nin,
      cardStatus: 'ACTIVE',
      cardValidUntil: '2030-12-31',
      replacementInProgress: false,
      correlationId: 'corr-nira-card-0003',
    };
  }
  if (target.includes('death-status')) {
    return {
      nin: sampleValues.nin,
      deceased: false,
      verificationStatus: 'NO_DEATH_RECORD_FLAGGED',
      checkedAt: '2026-05-28T09:00:00Z',
      correlationId: 'corr-nira-civil-0004',
    };
  }
  if (target.includes('household')) {
    return {
      relationshipConfirmed: true,
      relationship: 'DEPENDANT',
      confidenceScore: 0.91,
      manualReviewRequired: false,
      correlationId: 'corr-nira-household-0005',
    };
  }
  if (target.includes('audit-consent')) {
    return {
      consentReference: 'consent-nira-2026-00451',
      recorded: true,
      validForPurpose: true,
      expiresAt: '2026-06-27T08:55:00Z',
      correlationId: 'corr-nira-consent-0006',
    };
  }

  if (target.includes('tin-status')) {
    return {
      tin: sampleValues.tin,
      tinStatus: 'ACTIVE',
      taxpayerType: 'COMPANY',
      registeredName: 'KAMPALA DEMO TRADERS LTD',
      complianceStatus: 'COMPLIANT',
      correlationId: 'corr-ura-tin-0001',
    };
  }
  if (target.includes('clearance')) {
    return {
      tin: sampleValues.tin,
      clearanceStatus: 'CLEARED',
      validUntil: '2027-05-22',
      certificateReference: 'TCC-UG-2026-1000123456',
      issuingAuthority: 'Uganda Revenue Authority',
      correlationId: 'corr-ura-clearance-0002',
    };
  }
  if (target.includes('vat-status')) {
    return {
      tin: sampleValues.tin,
      vatRegistered: true,
      effectiveDate: '2021-07-01',
      filingFrequency: 'MONTHLY',
      status: 'ACTIVE',
      correlationId: 'corr-ura-vat-0003',
    };
  }
  if (target.includes('importer-status')) {
    return {
      tin: sampleValues.tin,
      importerEligible: true,
      customsAccountStatus: 'ACTIVE',
      blockedReasons: [],
      correlationId: 'corr-ura-importer-0004',
    };
  }
  if (target.includes('filing-obligations')) {
    return {
      tin: sampleValues.tin,
      obligations: [
        { taxHead: 'VAT', period: '2026-04', status: 'FILED' },
        { taxHead: 'PAYE', period: '2026-04', status: 'PENDING' },
      ],
      correlationId: 'corr-ura-filing-0005',
    };
  }
  if (target.includes('withholding-exemption')) {
    return {
      tin: sampleValues.tin,
      exempt: true,
      exemptionNumber: 'WHT-EX-2026-00045',
      validUntil: '2026-12-31',
      correlationId: 'corr-ura-wht-0006',
    };
  }

  if (target.includes('registration')) {
    return {
      brn: sampleValues.brn,
      registeredName: 'KAMPALA DEMO TRADERS LTD',
      registrationDate: '2019-03-18',
      entityType: 'Private Company Limited by Shares',
      status: 'ACTIVE',
      correlationId: 'corr-ursb-reg-0001',
    };
  }
  if (target.includes('name-search')) {
    return {
      query: 'Kampala Demo',
      results: [
        { brn: sampleValues.brn, registeredName: 'KAMPALA DEMO TRADERS LTD', status: 'ACTIVE' },
      ],
      resultCount: 1,
      correlationId: 'corr-ursb-search-0002',
    };
  }
  if (target.includes('company-status')) {
    return {
      companyNumber: sampleValues.companyNumber,
      status: 'ACTIVE',
      lastStatusChange: '2024-02-15',
      restrictions: [],
      correlationId: 'corr-ursb-status-0003',
    };
  }
  if (target.includes('directors')) {
    return {
      brn: sampleValues.brn,
      directors: [
        { fullName: 'JOHN DOE', nationality: 'UGANDAN', role: 'DIRECTOR', appointmentDate: '2020-01-12' },
      ],
      restrictedFieldsReturned: false,
      correlationId: 'corr-ursb-directors-0004',
    };
  }
  if (target.includes('beneficial-ownership')) {
    return {
      brn: sampleValues.brn,
      filingPresent: true,
      filingCurrent: true,
      lastFiledAt: '2026-01-31',
      detailsRequireSeparateApproval: true,
      correlationId: 'corr-ursb-bo-0005',
    };
  }
  if (target.includes('annual-return-status')) {
    return {
      brn: sampleValues.brn,
      latestReturnYear: 2025,
      status: 'FILED',
      dueDate: '2026-06-30',
      correlationId: 'corr-ursb-return-0006',
    };
  }

  if (target.includes('driving-permit') && target.includes('status')) {
    return {
      permitNumber: sampleValues.permitNumber,
      permitStatus: 'ACTIVE',
      holderVerified: true,
      validUntil: '2028-04-30',
      restrictions: [],
      correlationId: 'corr-mowt-status-0001',
    };
  }
  if (target.includes('driving-permit') && target.includes('classes')) {
    return {
      permitNumber: sampleValues.permitNumber,
      classes: [
        { code: 'B', description: 'Motor car', validUntil: '2028-04-30' },
        { code: 'CM', description: 'Medium goods vehicle', validUntil: '2027-11-15' },
      ],
      correlationId: 'corr-mowt-classes-0002',
    };
  }
  if (target.includes('renewal-eligibility')) {
    return {
      permitNumber: sampleValues.permitNumber,
      eligible: true,
      earliestRenewalDate: '2027-10-30',
      blockingReasons: [],
      correlationId: 'corr-mowt-renew-0003',
    };
  }
  if (target.includes('medical-validity')) {
    return {
      permitNumber: sampleValues.permitNumber,
      medicalFitnessValid: true,
      validUntil: '2027-05-31',
      clinicalDetailsReturned: false,
      correlationId: 'corr-mowt-medical-0004',
    };
  }
  if (target.includes('driver-test-results')) {
    return {
      nin: sampleValues.nin,
      latestAttemptDate: '2026-03-12',
      result: 'PASS',
      classTested: 'B',
      eligibleForIssuance: true,
      correlationId: 'corr-mowt-test-0005',
    };
  }
  if (target.includes('psv-eligibility')) {
    return {
      eligible: true,
      permitClassAccepted: true,
      medicalFitnessValid: true,
      outstandingRestrictions: [],
      correlationId: 'corr-mowt-psv-0006',
    };
  }

  if (target.includes('eligibility')) {
    return {
      overallDecision: 'ELIGIBLE',
      checks: [
        { source: 'NIRA', status: 'MATCH' },
        { source: 'URA', status: 'COMPLIANT' },
        { source: 'URSB', status: 'ACTIVE' },
        { source: 'MoWT', status: 'VALID' },
      ],
      nextSteps: ['Generate payment reference', 'Book service appointment'],
      correlationId: 'corr-sug-eligibility-0001',
    };
  }
  if (target.includes('case-status')) {
    return {
      caseId: sampleValues.caseId,
      status: 'AWAITING_PAYMENT',
      completedChecks: 4,
      pendingActions: ['PAYMENT_REFERENCE_CONFIRMATION'],
      updatedAt: '2026-05-28T09:10:00Z',
      correlationId: 'corr-sug-case-0002',
    };
  }
  if (target.includes('service-bundle')) {
    return {
      bundleId: sampleValues.bundleId,
      displayName: 'Business Startup Service Bundle',
      agencies: ['NIRA', 'URA', 'URSB'],
      checks: ['identityVerification', 'taxCompliance', 'businessRegistration'],
      requiredDocuments: ['nationalId', 'taxClearance'],
      correlationId: 'corr-sug-bundle-0003',
    };
  }
  if (target.includes('document-checklist')) {
    return {
      checklist: [
        { code: 'TAX_CLEARANCE', required: true, source: 'URA' },
        { code: 'BUSINESS_REGISTRATION', required: true, source: 'URSB' },
        { code: 'DIRECTOR_ID', required: true, source: 'NIRA' },
      ],
      correlationId: 'corr-sug-docs-0004',
    };
  }
  if (target.includes('appointment-slots')) {
    return {
      serviceCenter: 'Kampala One Stop Centre',
      slots: [
        { slotId: 'slot-kla-2026-05-29-0900', startsAt: '2026-05-29T09:00:00+03:00', capacityRemaining: 4 },
      ],
      correlationId: 'corr-sug-slots-0005',
    };
  }
  if (target.includes('payment-reference')) {
    return {
      paymentReference: 'PRN-2026-000145',
      amount: 125000,
      currency: 'UGX',
      expiresAt: '2026-06-04T09:00:00+03:00',
      paymentStatus: 'PENDING',
      correlationId: 'corr-sug-pay-0006',
    };
  }
  if (target.includes('notification-preferences')) {
    return {
      caseId: sampleValues.caseId,
      channels: ['sms', 'email'],
      updated: true,
      updatedAt: '2026-05-28T09:15:00Z',
      correlationId: 'corr-sug-notify-0007',
    };
  }

  return {
    requestId: 'req-demo-2026-0001',
    status: 'SUCCESS',
    result: {
      outcome: ep.data.summary || 'Sandbox response',
      matched: true,
    },
    correlationId: 'corr-demo-8b2f6a',
  };
}

export function responseExample(response: any, spec: any, ep: any, status: string) {
  const content = response?.content || {};
  const media = content['application/json'] || content[Object.keys(content)[0]];
  if (!media) return fallbackResponseExample(ep, status);
  if (media.example !== undefined) return media.example;
  const firstExample = media.examples ? Object.values(media.examples)[0] as any : null;
  if (firstExample?.value !== undefined) return firstExample.value;
  if (firstExample !== undefined) return firstExample;
  const fromSchema = schemaExample(media.schema, spec);
  return fromSchema === '' ? fallbackResponseExample(ep, status) : fromSchema;
}

function pathParametersFromRoute(route: string) {
  return [...route.matchAll(/\{([^}]+)\}/g)].map(match => ({
    name: match[1],
    in: 'path',
    required: true,
    description: `${match[1]} path value required by this endpoint.`,
    schema: { type: 'string', example: sampleValues[match[1]] || `sample-${match[1]}` },
  }));
}

export function endpointParameters(ep: any) {
  const explicit = ep.data.parameters || [];
  const missingPathParameters = pathParametersFromRoute(ep.path).filter(pathParam =>
    !explicit.some((param: any) => param.in === 'path' && param.name === pathParam.name)
  );
  return [...explicit, ...missingPathParameters];
}

export function coerceParameterValue(value: string, schema: any) {
  if (schema?.type === 'boolean') return value === 'true';
  if (schema?.type === 'integer') return Number.parseInt(value, 10);
  if (schema?.type === 'number') return Number.parseFloat(value);
  return value;
}

function formatConsoleBody(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return text.split('\n').map(line => {
    const valuePrefix = line.match(/^(\s*"[^"]+"\s*:\s*)/);
    const leadingWhitespace = line.match(/^\s*/)?.[0].length || 0;
    const hangingIndent = Math.min(valuePrefix?.[1].length || leadingWhitespace + 2, 36);
    return { line, hangingIndent };
  });
}

export function SandboxConsoleBody({ body, status }: { body: unknown; status: number }) {
  const toneClassName = status === 200 ? 'text-[#3ecf8e]' : 'text-red-400';
  const lines = formatConsoleBody(body).map(({ line, hangingIndent }, index) => (
    <span
      key={index}
      className="block whitespace-pre-wrap break-words"
      style={{ paddingLeft: `${hangingIndent}ch`, textIndent: `-${hangingIndent}ch` }}
    >
      {line || ' '}
    </span>
  ));

  return <pre className={`overflow-x-hidden leading-relaxed text-[12.5px] ${toneClassName}`}><code>{lines}</code></pre>;
}

export function getServerBasePath(spec: any, apiId: string) {
  if (!apiBasePathById[apiId]) {
    return `/api/v1/sandbox/${encodeURIComponent(apiId)}`;
  }
  const serverUrl = spec?.servers?.[0]?.url;
  if (serverUrl) {
    try {
      return new URL(serverUrl).pathname.replace(/\/$/, '');
    } catch {
      if (serverUrl.startsWith('/')) return serverUrl.replace(/\/$/, '');
    }
  }
  return apiBasePathById[apiId] || '/api/v1';
}

export function buildSampleUrl(spec: any, apiId: string, endpointPath: string) {
  const basePath = getServerBasePath(spec, apiId);
  const substitutedPath = endpointPath.replace(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(sampleValues[name] || `sample-${name}`));
  return new URL(`${basePath}${substitutedPath}`, API_BASE).toString();
}
