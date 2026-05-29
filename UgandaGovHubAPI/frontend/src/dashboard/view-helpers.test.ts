import assert from 'assert/strict';
import {
  MATRIX_TARGETS,
  buildMatrixChannelRows,
  getAuditEventTone,
  getRequestStatusLabel,
  isMatrixChannelActive,
} from './view-helpers.ts';

const matrix = [
  { consumer_mda_id: 'mda-01', api_id: 'api-nira-01' },
  { consumer_mda_id: 'mda-01', api_id: 'api-ura-01' },
  { consumer_mda_id: 'mda-02', api_id: 'api-ursb-01' },
];

assert.equal(getAuditEventTone('SANDBOX_CALL_DENIED'), 'denied');
assert.equal(getAuditEventTone('SANDBOX_CALL_ALLOWED'), 'allowed');
assert.equal(getAuditEventTone('ACCESS_APPROVED'), 'neutral');

assert.equal(getRequestStatusLabel({ status: 'PENDING' }), 'PENDING');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'ACTIVE' }), 'ACTIVE');
assert.equal(getRequestStatusLabel({ status: 'APPROVED', api_key_status: 'REVOKED' }), 'REVOKED');

assert.equal(isMatrixChannelActive(matrix, 'mda-01', 'api-nira-01'), true);
assert.equal(isMatrixChannelActive(matrix, 'mda-01', 'api-ursb-01'), false);

assert.deepEqual(
  buildMatrixChannelRows(matrix, 'mda-01').map(row => [row.apiId, row.label, row.active]),
  MATRIX_TARGETS.map(target => [
    target.apiId,
    target.label,
    target.apiId === 'api-nira-01' || target.apiId === 'api-ura-01',
  ])
);

console.log('dashboard view helper tests passed');
