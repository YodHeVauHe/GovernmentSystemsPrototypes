import React, { createContext, useContext, useMemo, useState } from 'react';
import { generatePublicId } from '@/lib/utils';

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
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: AddNotificationInput) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const STORAGE_KEY = 'govhub_notifications';
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function loadNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);

  const addNotification = (notification: AddNotificationInput) => {
    setNotifications(current => {
      const next = [
        {
          ...notification,
          id: generatePublicId('notification'),
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...current,
      ].slice(0, 20);
      saveNotifications(next);
      return next;
    });
  };

  const markAllRead = () => {
    setNotifications(current => {
      const next = current.map(notification => ({ ...notification, read: true }));
      saveNotifications(next);
      return next;
    });
  };

  const clearNotifications = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: notifications.filter(notification => !notification.read).length,
      addNotification,
      markAllRead,
      clearNotifications,
    }),
    [notifications]
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
