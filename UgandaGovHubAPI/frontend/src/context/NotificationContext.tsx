import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { generatePublicId } from '@/lib/utils';
import { useUser } from './UserContext';

export type AppNotificationType = 'api' | 'access' | 'key' | 'account';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface AddNotificationInput {
  type: AppNotificationType;
  title: string;
  message: string;
  recipientUserId?: string | null;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AddNotificationInput) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const STORAGE_KEY_PREFIX = 'govhub_notifications';
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function getNotificationStorageKey(userId: string | null | undefined) {
  return userId ? `${STORAGE_KEY_PREFIX}:${userId}` : null;
}

function loadNotifications(storageKey: string | null) {
  if (!storageKey) return [];

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(storageKey: string | null, notifications: AppNotification[]) {
  if (!storageKey) return;

  localStorage.setItem(storageKey, JSON.stringify(notifications));
}

function formatRoleLabel(role: string | null | undefined) {
  const labels: Record<string, string> = {
    admin: 'Admin',
    api_owner: 'API Owner',
    developer: 'Developer',
    reviewer: 'Compliance Reviewer',
  };

  if (!role) return 'Public';
  return labels[role] || role
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatUserNotificationMessage(message: string, user: ReturnType<typeof useUser>['user'], role: string, mdaShortName?: string) {
  if (!user) return message;

  const accountName = user.full_name || user.email || 'Current user';
  const organization = mdaShortName || user.requested_organization;
  const accountLabel = organization
    ? `${accountName} (${formatRoleLabel(role)}, ${organization})`
    : `${accountName} (${formatRoleLabel(role)})`;

  if (message.startsWith(`${accountLabel}:`)) return message;
  return `${accountLabel}: ${message}`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, role, currentMda } = useUser();
  const storageKey = useMemo(() => getNotificationStorageKey(user?.id), [user?.id]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(loadNotifications(storageKey));
  }, [storageKey]);

  const addNotification = useCallback((notification: AddNotificationInput) => {
    const { recipientUserId, ...notificationBody } = notification;
    const targetStorageKey = getNotificationStorageKey(recipientUserId || user?.id);
    if (!targetStorageKey) return;

    const createNext = (current: AppNotification[]) => [
      {
        ...notificationBody,
        id: generatePublicId('notification'),
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...current,
    ].slice(0, 20);

    if (targetStorageKey !== storageKey) {
      saveNotifications(targetStorageKey, createNext(loadNotifications(targetStorageKey)));
      return;
    }

    setNotifications(current => {
      const next = createNext(current);
      saveNotifications(storageKey, next);
      return next;
    });
  }, [storageKey, user?.id]);

  const markAllRead = useCallback(() => {
    setNotifications(current => {
      const next = current.map(notification => ({ ...notification, read: true }));
      saveNotifications(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    saveNotifications(storageKey, []);
  }, [storageKey]);

  const displayedNotifications = useMemo(
    () => notifications.map(notification => ({
      ...notification,
      message: formatUserNotificationMessage(notification.message, user, role, currentMda?.shortName),
    })),
    [currentMda?.shortName, notifications, role, user]
  );

  const value = useMemo(
    () => ({
      notifications: displayedNotifications,
      unreadCount: notifications.filter(notification => !notification.read).length,
      addNotification,
      markAllRead,
      clearNotifications,
    }),
    [addNotification, clearNotifications, displayedNotifications, markAllRead, notifications]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
