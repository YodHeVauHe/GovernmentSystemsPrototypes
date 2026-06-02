import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarGrid,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { getTimeRangeLabel, type DistributionRow, type TrafficBucket } from './dashboard-page-helpers';

const auditHitsChartConfig = {
  hits: {
    label: 'Sandbox hits',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig;

const registryChartColors = [
  'var(--color-primary)',
  'hsl(217 91% 60%)',
  'hsl(var(--warning-default))',
  'hsl(272 90% 72%)',
  'hsl(48 96% 53%)',
  'hsl(var(--destructive-default))',
] as const;

type AnalyticsPanelProps = {
  timeRange: string;
  setTimeRange: (value: string) => void;
  analyticsLogs: unknown[];
  analyticsAllowed: number;
  analyticsDenied: number;
  analyticsSuccessRate: number;
  analyticsTraffic: TrafficBucket[];
  analyticsDistribution: DistributionRow[];
};

type ChartTooltipPayload = {
  payload?: {
    count?: number;
    label?: string;
    percentage?: number;
  };
};

type AnalyticsTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayload[];
};

function AuditHitsTooltip({ active, label, payload }: AnalyticsTooltipProps) {
  if (!active || !payload?.length) return null;

  const count = payload[0]?.payload?.count ?? 0;

  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#141414] px-3 py-2 text-[12px] shadow-xl">
      <div className="font-mono text-[11px] uppercase tracking-wider text-[#8b8b8b]">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-white">
        <span className="size-2 rounded-[2px] bg-[#3ecf8e]" />
        <span className="font-medium">{count.toLocaleString()} sandbox hits</span>
      </div>
    </div>
  );
}

function RegistryTooltip({ active, payload }: AnalyticsTooltipProps) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#141414] px-3 py-2 text-[12px] shadow-xl">
      <div className="max-w-[220px] truncate font-medium text-white">{row.label}</div>
      <div className="mt-1 font-mono text-[11px] text-[#8b8b8b]">
        {(row.count ?? 0).toLocaleString()} requests / {row.percentage ?? 0}%
      </div>
    </div>
  );
}

export function AnalyticsPanel({
  timeRange,
  setTimeRange,
  analyticsLogs,
  analyticsAllowed,
  analyticsDenied,
  analyticsSuccessRate,
  analyticsTraffic,
  analyticsDistribution,
}: AnalyticsPanelProps) {
  const registryChartRows = analyticsDistribution.slice(0, registryChartColors.length).map((row, index) => ({
    ...row,
    registry: `registry${index}`,
    fill: `var(--color-registry${index})`,
    color: registryChartColors[index],
  }));
  const registryChartConfig = registryChartRows.reduce<ChartConfig>((config, row, index) => {
    config[row.registry] = {
      label: row.label,
      color: registryChartColors[index],
    };
    return config;
  }, {
    count: {
      label: 'Requests',
    },
  });

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

                  <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">

                    {/* Traffic Chart */}
                    <div className="flex flex-col rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-6 shadow-lg">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-white">Audited Sandbox Hits</h3>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#8b8b8b]">{getTimeRangeLabel(timeRange)}</span>
                      </div>

                      <ChartContainer
                        config={auditHitsChartConfig}
                        className="aspect-auto h-[260px] w-full font-mono text-[11px]"
                      >
                        <BarChart
                          accessibilityLayer
                          data={analyticsTraffic}
                          barCategoryGap="22%"
                          margin={{
                            top: 22,
                            right: 8,
                            bottom: 2,
                            left: 8,
                          }}
                        >
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            interval={0}
                            tickFormatter={(value) => value}
                          />
                          <YAxis hide dataKey="count" domain={[0, 'dataMax']} />
                          <ChartTooltip
                            cursor={{ fill: 'hsl(var(--brand-default) / 0.08)' }}
                            content={<AuditHitsTooltip />}
                          />
                          <Bar
                            dataKey="count"
                            name="hits"
                            radius={[3, 3, 0, 0]}
                            minPointSize={4}
                            activeBar={{ fillOpacity: 1 }}
                          >
                            {analyticsTraffic.map((bucket: any) => (
                              <Cell
                                key={bucket.key}
                                fill={bucket.count > 0 ? 'var(--color-hits)' : 'var(--muted)'}
                                fillOpacity={bucket.label === 'Today' ? 0.95 : bucket.count > 0 ? 0.78 : 0.35}
                              />
                            ))}
                            <LabelList
                              dataKey="count"
                              position="top"
                              offset={8}
                              className="fill-foreground text-[10px]"
                            />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </div>

                    {/* Endpoint Distribution */}
                    <div className="flex flex-col rounded-xl border border-[#2e2e2e] bg-[#1c1c1c] p-6 shadow-lg">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-[14px] font-semibold text-white">Request Distribution by Registry</h3>
                        <span className="text-[11px] font-mono text-[#8b8b8b]">{analyticsDistribution.length} registries</span>
                      </div>

                      {registryChartRows.length === 0 ? (
                        <div className="flex min-h-[250px] items-center justify-center rounded-lg border border-dashed border-[#2e2e2e] bg-[#141414] px-4 text-center text-[13px] text-[#8b8b8b]">
                          No sandbox traffic has been audited for {getTimeRangeLabel(timeRange).toLowerCase()}.
                        </div>
                      ) : (
                        <div className="flex flex-1 flex-col gap-4">
                          <ChartContainer
                            config={registryChartConfig}
                            className="mx-auto aspect-square h-[220px] max-h-[220px] w-full"
                          >
                            <RadialBarChart
                              accessibilityLayer
                              data={registryChartRows}
                              innerRadius={30}
                              outerRadius={104}
                            >
                              <ChartTooltip
                                cursor={false}
                                content={<RegistryTooltip />}
                              />
                              <PolarGrid gridType="circle" />
                              <RadialBar dataKey="count" background />
                            </RadialBarChart>
                          </ChartContainer>

                          <div className="grid gap-2">
                            {registryChartRows.map((row) => (
                              <div key={row.id} className="flex items-center justify-between gap-3 text-[12px]">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: row.color }} />
                                  <span className="min-w-0 truncate font-medium text-white" title={row.label}>
                                    {row.label}
                                  </span>
                                </div>
                                <span className="shrink-0 font-mono text-[#8b8b8b]">{row.count} / {row.percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
  );
}
