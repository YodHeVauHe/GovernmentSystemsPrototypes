import assert from 'assert/strict';
import {
  buildPendingAccessRequestNotifications,
  pendingAccessRequestNotificationKey,
} from './access-request-notifications.ts';

const requests = [
  {
    id: 'req-1',
    status: 'PENDING',
    consumer_name: 'MoH',
    mda_name: 'Ministry of Health',
    api_name: 'NIRA Identity',
  },
  {
    id: 'req-2',
    status: 'APPROVED',
    consumer_name: 'MoICT',
    api_name: 'Business Registry',
  },
  {
    id: 'req-3',
    status: 'PENDING',
    consumer_user_id: 'usr-1',
    api_name: 'Tax Clearance',
  },
];

assert.equal(pendingAccessRequestNotificationKey('req-1'), 'access-request:req-1');

assert.deepEqual(
  buildPendingAccessRequestNotifications(requests, new Set(['access-request:req-3'])),
  [
    {
      key: 'access-request:req-1',
      type: 'access',
      title: 'New access request',
      message: 'MoH requested access to NIRA Identity.',
    },
  ]
);

console.log('access request notification tests passed');
