import {
  IconChartBar,
  IconCircleCheck,
  IconGridPattern,
  IconInnerShadowTop,
  IconKey,
  IconListDetails,
  IconShield,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { DashboardViewTab } from '../view-helpers';

type AdminDashboardSideMenuProps = {
  activeTab: DashboardViewTab;
  setActiveTab: (tab: DashboardViewTab) => void;
  pendingApprovals: number;
  pendingAccountCount: number;
};

type AdminDashboardMenuItem = {
  key: DashboardViewTab;
  name: string;
  icon: typeof IconShield;
  countKey?: 'pendingApprovals' | 'pendingAccountCount';
};

type AdminDashboardMenuGroup = {
  title: string;
  items: AdminDashboardMenuItem[];
};

const adminMenuSections: AdminDashboardMenuGroup[] = [
  {
    title: 'Requests',
    items: [
      { key: 'approvals', name: 'Access Approvals', icon: IconShield, countKey: 'pendingApprovals' },
      { key: 'accounts', name: 'Accounts', icon: IconCircleCheck, countKey: 'pendingAccountCount' },
    ],
  },
  {
    title: 'Credentials',
    items: [
      { key: 'credentials', name: 'My Agency Credentials', icon: IconKey },
      { key: 'apiLogs', name: 'API Call Logs', icon: IconListDetails },
    ],
  },
  {
    title: 'Governance',
    items: [
      { key: 'audit', name: 'Audit Trails', icon: IconListDetails },
      { key: 'matrix', name: 'Interoperability Matrix', icon: IconGridPattern },
      { key: 'analytics', name: 'Analytics', icon: IconChartBar },
    ],
  },
];

function ProductMenuBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-[#141414]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[#2e2e2e] px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <IconInnerShadowTop className="size-4" />
        </div>
        <div className="min-w-0 text-left text-sm leading-tight">
          <div className="truncate font-semibold text-white">Uganda GovHub API</div>
          <div className="truncate text-xs text-[#8b8b8b]">Developer Portal</div>
        </div>
      </div>
      <div className="min-h-0 grow overflow-y-auto">{children}</div>
    </div>
  );
}

function ProductMenu({
  activeTab,
  setActiveTab,
  counts,
}: {
  activeTab: DashboardViewTab;
  setActiveTab: (tab: DashboardViewTab) => void;
  counts: Record<'pendingApprovals' | 'pendingAccountCount', number>;
}) {
  return (
    <div className="flex flex-col py-2">
      {adminMenuSections.map((group, groupIndex) => (
        <div key={group.title}>
          <div className="py-3">
            <div className="md:mx-2">
              <div className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-wide text-[#6f6f6f]">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  const count = item.countKey ? counts[item.countKey] : 0;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={`flex min-h-8 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                        isActive ? 'bg-[#2e2e2e] text-white' : 'text-[#b5b5b5] hover:bg-[#1f1f1f] hover:text-white'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </span>
                      {count > 0 && (
                        <span className="ml-2 flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {groupIndex !== adminMenuSections.length - 1 && (
            <div className="mx-auto h-px w-[calc(100%-1.5rem)] bg-[#2e2e2e] md:w-full" />
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardSideMenu({
  activeTab,
  setActiveTab,
  pendingApprovals,
  pendingAccountCount,
}: AdminDashboardSideMenuProps) {
  const counts = { pendingApprovals, pendingAccountCount };

  return (
    <aside className="flex w-full shrink-0 border-b border-[#2e2e2e] md:h-full md:w-[208px] md:border-b-0 md:border-r">
      <ProductMenuBar>
        <ProductMenu activeTab={activeTab} setActiveTab={setActiveTab} counts={counts} />
      </ProductMenuBar>
    </aside>
  );
}
