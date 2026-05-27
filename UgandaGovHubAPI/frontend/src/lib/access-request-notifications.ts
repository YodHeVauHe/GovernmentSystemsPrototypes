import type { AppNotificationType } from '@/context/NotificationContext';

type AccessRequestNotificationInput = {
  id?: string | null;
  status?: string | null;
  consumer_name?: string | null;
  mda_name?: string | null;
  consumer_user_id?: string | null;
  api_name?: string | null;
};

export type PendingAccessRequestNotification = {
  key: string;
  type: AppNotificationType;
  title: string;
  message: string;
};

export function pendingAccessRequestNotificationKey(requestId: string) {
  return `access-request:${requestId}`;
}

function requesterName(request: AccessRequestNotificationInput) {
  return request.consumer_name || request.mda_name || request.consumer_user_id || 'A GovHub user';
}

export function buildPendingAccessRequestNotifications(
  requests: AccessRequestNotificationInput[],
  existingKeys: Set<string>
): PendingAccessRequestNotification[] {
  return requests
    .filter(request => request.id && request.status === 'PENDING')
    .map(request => ({
      key: pendingAccessRequestNotificationKey(String(request.id)),
      type: 'access' as const,
      title: 'New access request',
      message: `${requesterName(request)} requested access to ${request.api_name || 'an API'}.`,
    }))
    .filter(notification => !existingKeys.has(notification.key));
}
