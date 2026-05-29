import type { ReactNode } from 'react';

type SettingsTabFrameProps = {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  headerActions?: ReactNode;
};

export function SettingsTabFrame({
  icon,
  title,
  description,
  children,
  headerActions,
}: SettingsTabFrameProps) {
  return (
    <div data-testid="account-settings-active-pane" className="space-y-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-0">
      <div className="flex shrink-0 flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            {icon}
            {title}
          </h2>
          <p className="mt-1 text-xs text-foreground-light">{description}</p>
        </div>
        {headerActions}
      </div>

      <div data-testid="account-settings-pane-body" className="space-y-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-2">
        {children}
      </div>
    </div>
  );
}
