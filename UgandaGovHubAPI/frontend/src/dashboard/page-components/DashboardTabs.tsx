import { IconChartBar, IconCircleCheck, IconGridPattern, IconKey, IconListDetails, IconShield } from '@tabler/icons-react';

export function DashboardTabs({ role, activeTab, setActiveTab, pendingApprovals, pendingAccountCount, canViewAuditLogs }: any) {
  return (
          <div className="flex shrink-0 border-b border-[#2e2e2e] gap-1 bg-[#141414] p-1 rounded-lg self-start">
            {role !== 'developer' && role !== 'reviewer' && (
              <button
                onClick={() => setActiveTab('approvals')}
                className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'approvals' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                }`}
              >
                <IconShield className="w-4 h-4" />
                Access Approvals
                {pendingApprovals > 0 && (
                  <span className="h-4.5 min-w-4.5 px-1 bg-orange-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center">
                    {pendingApprovals}
                  </span>
                )}
              </button>
            )}

            {role === 'admin' && (
              <button
                onClick={() => setActiveTab('accounts')}
                className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'accounts' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                }`}
              >
                <IconCircleCheck className="w-4 h-4" />
                Accounts
                {pendingAccountCount > 0 && (
                  <span className="h-4.5 min-w-4.5 px-1 bg-orange-500 text-white font-bold rounded-full text-[10px] flex items-center justify-center">
                    {pendingAccountCount}
                  </span>
                )}
              </button>
            )}

            {(role === 'developer' || role === 'admin') && (
              <button
                onClick={() => setActiveTab('credentials')}
                className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'credentials' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                }`}
              >
                <IconKey className="w-4 h-4" />
                My Agency Credentials
              </button>
            )}

            {canViewAuditLogs && (
              <>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'audit' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                  }`}
                >
                  <IconListDetails className="w-4 h-4" />
                  {role === 'developer' ? 'API Call Logs' : 'Audit Trails'}
                </button>
                {(role === 'reviewer' || role === 'admin') && (
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                      activeTab === 'matrix' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                    }`}
                  >
                    <IconGridPattern className="w-4 h-4" />
                    Interoperability Matrix
                  </button>
                )}
              </>
            )}

            {(role === 'developer' || role === 'reviewer' || role === 'admin') && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={`h-9 px-4 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'analytics' ? 'bg-[#2e2e2e] text-white' : 'text-[#8b8b8b] hover:text-white'
                }`}
              >
                <IconChartBar className="w-4 h-4" />
                Analytics
              </button>
            )}
          </div>
  );
}
