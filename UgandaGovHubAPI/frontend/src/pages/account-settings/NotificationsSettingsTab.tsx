import { IconBell, IconChecks, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import type { AppNotification } from '@/context/NotificationContext';
import { SettingsTabFrame } from './SettingsTabFrame';

type NotificationsSettingsTabProps = {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
};

export function NotificationsSettingsTab({
  notifications,
  onMarkAllRead,
  onClearNotifications,
}: NotificationsSettingsTabProps) {
  return (
    <SettingsTabFrame
      icon={<IconBell className="size-5 text-[#3ecf8e]" />}
      title="Notifications Inbox"
      description="Stay updated with comments from validators, key approvals, and platform alerts."
      headerActions={notifications.length > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onMarkAllRead} className="h-8 gap-1.5 border-border bg-card text-xs font-semibold text-foreground transition-colors hover:bg-background">
            <IconChecks className="size-3.5" />
            Mark all read
          </Button>
          <Button variant="outline" onClick={onClearNotifications} className="h-8 gap-1.5 border-border bg-card text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive">
            <IconTrash className="size-3.5" />
            Clear all
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/20 p-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground-muted">
              <IconBell className="size-6" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">All caught up!</h4>
            <p className="mt-1 text-xs text-foreground-light">You have no new alerts or validation comments.</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div key={notification.id} className="flex items-start gap-3 rounded-lg border border-border bg-background/30 p-4 transition-all hover:bg-background/50">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3ecf8e]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="truncate text-sm font-semibold text-foreground">{notification.title}</div>
                  <div className="shrink-0 font-mono text-xs text-foreground-muted">
                    {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="mt-1 text-xs leading-relaxed text-foreground-light">{notification.message}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </SettingsTabFrame>
  );
}
