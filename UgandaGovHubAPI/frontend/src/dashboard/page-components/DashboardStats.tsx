import { IconActivity, IconClock, IconKey, IconShield } from '@tabler/icons-react';

export function DashboardStats({ totalApproved, pendingApprovals, totalCallsCount, successRate }: any) {
  return (
          <div className="grid shrink-0 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1 */}
            <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Approved Channels</span>
                <span className="text-[24px] font-bold text-white mt-1">{totalApproved}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
                <IconKey className="w-5 h-5" />
              </div>
            </div>

            {/* Stat 2 */}
            <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Pending Approvals</span>
                <span className="text-[24px] font-bold text-white mt-1">{pendingApprovals}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-400/10 border border-orange-400/20 flex items-center justify-center text-orange-400">
                <IconClock className="w-5 h-5" />
              </div>
            </div>

            {/* Stat 3 */}
            <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Total Audited Hits</span>
                <span className="text-[24px] font-bold text-white mt-1">{totalCallsCount}</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <IconActivity className="w-5 h-5" />
              </div>
            </div>

            {/* Stat 4 */}
            <div className="p-4 border border-[#2e2e2e] bg-[#1c1c1c] rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[12px] font-mono text-[#8b8b8b] uppercase tracking-wider">Compliance Rate</span>
                <span className="text-[24px] font-bold text-white mt-1">{successRate}%</span>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#3ecf8e]/10 border border-[#3ecf8e]/20 flex items-center justify-center text-[#3ecf8e]">
                <IconShield className="w-5 h-5" />
              </div>
            </div>
          </div>
  );
}
