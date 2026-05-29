export type ViewMode = 'list' | 'grid';

export type AuditEventTone = 'denied' | 'allowed' | 'neutral';

export type MatrixTarget = {
  apiId: string;
  label: string;
};

export const MATRIX_TARGETS: MatrixTarget[] = [
  { apiId: 'api-nira-01', label: 'NIRA Identity' },
  { apiId: 'api-ura-01', label: 'URA Tax Clearance' },
  { apiId: 'api-ursb-01', label: 'URSB Registry' },
  { apiId: 'api-mowt-01', label: 'MoWT Transport' },
  { apiId: 'api-moict-01', label: 'MoICT Composite' },
];

export function getAuditEventTone(eventType: string): AuditEventTone {
  if (eventType.includes('DENIED')) return 'denied';
  if (eventType.includes('ALLOWED')) return 'allowed';
  return 'neutral';
}

export function getRequestStatusLabel(request: { status?: string; api_key_status?: string | null }) {
  return request.status === 'APPROVED'
    ? request.api_key_status || 'ACTIVE'
    : request.status || 'PENDING';
}

export function isMatrixChannelActive(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  apiId: string
) {
  return matrix.some(row => row.consumer_mda_id === consumerMdaId && row.api_id === apiId);
}

export function buildMatrixChannelRows(
  matrix: Array<{ consumer_mda_id?: string; api_id?: string }>,
  consumerMdaId: string,
  targets = MATRIX_TARGETS
) {
  return targets.map(target => ({
    ...target,
    active: isMatrixChannelActive(matrix, consumerMdaId, target.apiId),
  }));
}
