import { IconAlertTriangle, IconCheck, IconCircleCheck, IconShieldCheck } from '@tabler/icons-react';
import { SettingsTabFrame } from './SettingsTabFrame';
import type { AccountPrivileges } from './types';

export function PrivilegesSettingsTab({ privileges }: { privileges: AccountPrivileges }) {
  return (
    <SettingsTabFrame
      icon={<IconShieldCheck className="size-5 text-[#3ecf8e]" />}
      title="Security Privileges"
      description="Your assigned clearance tier and operational permissions on the GovHub platform."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <PrivilegeList title={privileges.accessGroup} tone="allowed" emptyText="No custom permissions granted." items={privileges.permissions} />
        <PrivilegeList title="Account Restrictions" tone="restricted" emptyText="No active restrictions on this account." items={privileges.restrictions} />
      </div>
    </SettingsTabFrame>
  );
}

function PrivilegeList({
  title,
  tone,
  emptyText,
  items,
}: {
  title: string;
  tone: 'allowed' | 'restricted';
  emptyText: string;
  items: string[];
}) {
  const isAllowed = tone === 'allowed';
  const hasItems = items.length > 0;
  const headerClassName = isAllowed
    ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]'
    : hasItems
      ? 'bg-red-500/10 text-red-300'
      : 'bg-[#3ecf8e]/10 text-[#3ecf8e]';
  const dotClassName = isAllowed || !hasItems ? 'bg-[#3ecf8e]' : 'bg-red-400';

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/40 shadow-sm">
      <div className={`flex items-center gap-2 border-b border-border px-4 py-3 ${headerClassName}`}>
        <div className={`h-2 w-2 rounded-full ${dotClassName}`} />
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="p-4">
        <p className="mb-3 text-xs text-foreground-light">
          {isAllowed
            ? 'Approved permissions available to this account:'
            : hasItems
              ? 'Active restrictions currently applied to this account:'
              : 'No safeguard restrictions are currently applied to this account.'}
        </p>
        <ul className="space-y-2.5">
          {!hasItems ? (
            <li className="flex items-start gap-2.5 text-xs text-foreground">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3ecf8e]/10 text-[#3ecf8e]">
                <IconCircleCheck className="size-3" />
              </span>
              <span>{emptyText}</span>
            </li>
          ) : (
            items.map(item => (
              <li key={item} className="flex items-start gap-2.5 text-xs text-foreground">
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${isAllowed ? 'bg-[#3ecf8e]/10 text-[#3ecf8e]' : 'bg-red-500/10 text-red-300'}`}>
                  {isAllowed ? <IconCheck className="size-3" /> : <IconAlertTriangle className="size-3" />}
                </span>
                <span>{item}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
