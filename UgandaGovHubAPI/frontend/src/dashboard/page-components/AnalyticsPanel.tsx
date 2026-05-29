import { getTimeRangeLabel } from './dashboard-page-helpers';

export function AnalyticsPanel({
  timeRange,
  setTimeRange,
  analyticsLogs,
  analyticsAllowed,
  analyticsDenied,
  analyticsSuccessRate,
  analyticsTraffic,
  maxTrafficCount,
  analyticsDistribution,
  distributionColors,
}: any) {
  return (
              <div className="flex h-full min-h-0 flex-col gap-6 text-left">
                <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[18px] font-semibold text-white">Usage Analytics</h2>
                    <p className="mt-0.5 text-[13px] text-[#8b8b8b]">
                      Real sandbox traffic derived from audit logs and API key enforcement outcomes.
                    </p>
                  </div>
                  <select
                    value={timeRange}
                    onChange={event => setTimeRange(event.target.value)}
                    className="h-[34px] w-fit rounded-md border border-[#2e2e2e] bg-[#141414] px-2 text-[12px] text-white focus:outline-none"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Sandbox Hits</span>
                      <div className="mt-1 text-[26px] font-bold text-white">{analyticsLogs.length}</div>
                      <div className="mt-1 text-[11px] text-[#8b8b8b]">{getTimeRangeLabel(timeRange)}</div>
                    </div>
                    <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Allowed Calls</span>
                      <div className="mt-1 text-[26px] font-bold text-[#3ecf8e]">{analyticsAllowed}</div>
                      <div className="mt-1 text-[11px] text-[#8b8b8b]">Authorized sandbox requests</div>
                    </div>
                    <div className="rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-4">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">Denied Calls</span>
                      <div className="mt-1 text-[26px] font-bold text-red-300">{analyticsDenied}</div>
                      <div className="mt-1 text-[11px] text-[#8b8b8b]">{analyticsSuccessRate}% success rate</div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Traffic Chart */}
                    <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg">
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-white">Audited Sandbox Hits</h3>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">{getTimeRangeLabel(timeRange)}</span>
                      </div>

                      <div className="h-64 flex items-end justify-between gap-2 overflow-x-auto border-b border-[#2e2e2e] pb-1.5 pt-6 font-mono text-[11px] text-[#8b8b8b]">
                        {analyticsTraffic.map((bucket: any) => (
                          <div key={bucket.key} className="flex min-w-[28px] flex-1 flex-col items-center gap-2">
                            <span className="text-[10px] text-[#ededed]">{bucket.count}</span>
                            <div
                              className={`w-full min-w-[22px] rounded-t-sm border-t transition-all ${
                                bucket.count > 0
                                  ? 'border-[#3ecf8e] bg-gradient-to-t from-[#3ecf8e]/20 to-[#3ecf8e]/80'
                                  : 'border-[#2e2e2e] bg-[#141414]'
                              }`}
                              style={{ height: `${Math.max(6, (bucket.count / maxTrafficCount) * 92)}%` }}
                            />
                            <span className={bucket.label === 'Today' ? 'font-bold text-[#3ecf8e]' : ''}>{bucket.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Endpoint Distribution */}
                    <div className="border border-[#2e2e2e] bg-[#1c1c1c] p-6 rounded-xl shadow-lg flex flex-col">
                      <div className="mb-6 flex items-center justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-white">Request Distribution by Registry</h3>
                        <span className="text-[11px] font-mono text-[#8b8b8b]">{analyticsDistribution.length} registries</span>
                      </div>

                      <div className="flex flex-col gap-4 mt-2">
                        {analyticsDistribution.length === 0 ? (
                          <div className="flex min-h-[190px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                            No sandbox traffic has been audited for {getTimeRangeLabel(timeRange).toLowerCase()}.
                          </div>
                        ) : analyticsDistribution.map((row: any, index: number) => (
                          <div key={row.id}>
                            <div className="flex justify-between gap-4 text-[12px] mb-1 font-medium text-white">
                              <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
                              <span className="shrink-0 font-mono text-[#8b8b8b]">{row.count} / {row.percentage}%</span>
                            </div>
                            <div className="h-2 w-full bg-[#141414] rounded-full overflow-hidden border border-[#2e2e2e]">
                              <div
                                className={`h-full rounded-full ${distributionColors[index % distributionColors.length]}`}
                                style={{ width: `${Math.max(2, row.percentage)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
  );
}
