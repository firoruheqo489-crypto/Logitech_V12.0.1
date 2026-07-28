"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeCheck,
  Gauge,
  Layers,
  PackageCheck,
  TrendingUp,
} from "lucide-react";

import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";
import type { LaboratoryArchiveRecord } from "@/lib/laboratory-archive-api";
import { cn } from "@/lib/utils";
import {
  buildEngineeringSpecDailyStats,
  buildEngineeringSpecMonthlyStats,
  buildEngineeringSpecReportMonthlyStats,
} from "../lib/engineering-spec-analytics";

const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

export function EngineeringSpecAnalyticsDashboard({
  archives,
  laboratoryArchives = [],
}: {
  archives: EngineeringSpecLedgerRecord[];
  laboratoryArchives?: LaboratoryArchiveRecord[];
}) {
  const orderedArchives = orderArchivesBySequence(archives);
  const monthlyData = buildEngineeringSpecMonthlyStats(orderedArchives);
  const currentMonth = monthlyData.at(-1) ?? {
    specCount: 0,
    sampleCount: 0,
    finalSampleCount: 0,
    completionRate: 0,
  };
  const volumeData = buildEngineeringSpecDailyStats(orderedArchives);
  const categoryData = buildCategoryBreakdown(orderedArchives);
  const categoryTotal = categoryData.reduce((sum, item) => sum + item.value, 0);
  const categoryChartData = categoryData.map(item => ({
    ...item,
    label: `${item.value}（${
      categoryTotal === 0 ? 0 : ((item.value / categoryTotal) * 100).toFixed(0)
    }%）`,
  }));
  const sampleTypeData = buildCurrentMonthSampleTypeBreakdown(currentMonth);
  const reportMonthlyData = buildEngineeringSpecReportMonthlyStats(
    orderedArchives,
    laboratoryArchives
  );
  const currentReportMonth = reportMonthlyData.at(-1) ?? {
    ledgerCount: 0,
    matchedReportCount: 0,
    attainmentRate: 0,
    sampleAverageCycleDays: null,
    finalSampleAverageCycleDays: null,
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/[0.06] bg-white/[0.03] px-5 py-3">
        <h1 className="text-sm font-semibold leading-tight text-slate-100">
          规格书统计看板
        </h1>
      </header>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Layers}
            label="本月已收样品数"
            sub="Samples Received"
            value={String(currentMonth.specCount)}
            unit="份"
          />
          <KpiCard
            icon={PackageCheck}
            label="本月样品单"
            sub="Sample Orders"
            value={String(currentMonth.sampleCount)}
            unit="单"
          />
          <KpiCard
            icon={BadgeCheck}
            label="本月终样单"
            sub="Final Sample Orders"
            value={String(currentMonth.finalSampleCount)}
            unit="单"
          />
          <KpiCard
            icon={Gauge}
            label="本月完成率"
            sub="Completion Rate"
            value={String(currentMonth.completionRate)}
            unit="%"
            accent
          />
        </div>

        <Panel title="月度处理趋势" sub="Recent 12 Months" className="mt-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyData}
                margin={{ top: 12, right: 8, left: -12, bottom: 8 }}
              >
                <XAxis
                  dataKey="monthLabel"
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={value => `${value}%`}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.35 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  wrapperStyle={{ color: "#fff" }}
                  formatter={(value, name) => [
                    name === "完成率" ? `${value}%` : value,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="specCount"
                  name="规格书"
                  fill="var(--chart-1)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  yAxisId="count"
                  dataKey="sampleCount"
                  name="样品单"
                  fill="var(--chart-2)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  yAxisId="count"
                  dataKey="finalSampleCount"
                  name="终样单"
                  fill="var(--chart-3)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="completionRate"
                  name="完成率"
                  stroke="var(--chart-4)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--chart-4)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="每日处理量"
          sub="Current Month · Daily"
          className="mt-3"
          headerAside={
            <div className="flex items-center gap-3 font-mono text-[11px]">
              {sampleTypeData.map(item => (
                <span
                  key={item.type}
                  className="whitespace-nowrap text-muted-foreground"
                >
                  <span
                    className={
                      item.type === "终样" ? "text-cyan-300" : "text-violet-300"
                    }
                  >
                    {item.type}
                  </span>{" "}
                  {item.value} 个（{item.percentage}%）
                </span>
              ))}
            </div>
          }
        >
          <div className="h-[316px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={volumeData}
                margin={{ top: 8, right: 8, left: -16, bottom: 18 }}
              >
                <XAxis
                  dataKey="day"
                  interval={0}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  wrapperStyle={{ color: "#fff" }}
                />
                <Bar
                  dataKey="count"
                  name="处理总数"
                  fill="var(--chart-1)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={42}
                />
                <Bar
                  dataKey="pass"
                  name="一次通过"
                  fill="var(--chart-2)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="样品分布" sub="By Product Category" className="mt-3">
          <div
            data-layout="horizontal-category-bars"
            data-category-order={categoryData.map(item => item.type).join(",")}
            className="w-full"
            style={{ height: Math.max(320, categoryData.length * 34) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={categoryChartData}
                margin={{ top: 4, right: 96, left: 8, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={100}
                  interval={0}
                  tick={{
                    fill: "var(--foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)", opacity: 0.35 }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  wrapperStyle={{ color: "#fff" }}
                />
                <Bar
                  dataKey="value"
                  name="单数"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                >
                  {categoryChartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                    />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="right"
                    fill="var(--muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="mt-5 border-t border-white/[0.06] pt-5">
          <h2 className="text-base font-semibold text-slate-100">
            报告完成统计
          </h2>
          <p className="mt-1 font-mono text-[10px] tracking-wider text-muted-foreground">
            Ledger-to-Laboratory Report Analytics
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Gauge}
            label="本月报告完成率"
            sub="Report Attainment"
            value={String(currentReportMonth.attainmentRate)}
            unit="%"
            accent
          />
          <KpiCard
            icon={Layers}
            label="本月台账 / 报告"
            sub="Ledger / Matched Reports"
            value={`${currentReportMonth.matchedReportCount}/${currentReportMonth.ledgerCount}`}
            unit="单"
          />
          <KpiCard
            icon={PackageCheck}
            label="样品平均周期"
            sub="Sample Average Cycle"
            value={formatCycleDays(currentReportMonth.sampleAverageCycleDays)}
            unit="天"
          />
          <KpiCard
            icon={BadgeCheck}
            label="终样平均周期"
            sub="Final Sample Average Cycle"
            value={formatCycleDays(
              currentReportMonth.finalSampleAverageCycleDays
            )}
            unit="天"
          />
        </div>

        <Panel title="月度报告达成率" sub="Recent 12 Months" className="mt-3">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={reportMonthlyData}
                margin={{ top: 12, right: 8, left: -12, bottom: 8 }}
              >
                <XAxis
                  dataKey="monthLabel"
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  allowDecimals={false}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={value => `${value}%`}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value, name) => [
                    name === "达成率" ? `${value}%` : value,
                    name,
                  ]}
                />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                <Bar
                  yAxisId="count"
                  dataKey="ledgerCount"
                  name="登记台账"
                  fill="var(--chart-1)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  yAxisId="count"
                  dataKey="matchedReportCount"
                  name="匹配报告"
                  fill="var(--chart-3)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="attainmentRate"
                  name="达成率"
                  stroke="var(--chart-4)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--chart-4)", strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="月度报告周期" sub="Calendar Days" className="mt-3">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={reportMonthlyData}
                margin={{ top: 12, right: 8, left: -12, bottom: 8 }}
              >
                <XAxis
                  dataKey="monthLabel"
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  unit="天"
                  allowDecimals={false}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value, name) => [`${value} 天`, name]}
                />
                <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                <Line
                  type="monotone"
                  dataKey="sampleAverageCycleDays"
                  name="样品平均周期"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 4, fill: "var(--chart-2)", strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="finalSampleAverageCycleDays"
                  name="终样平均周期"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                  connectNulls={false}
                  dot={{ r: 4, fill: "var(--chart-3)", strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  sub,
  value,
  unit,
  accent,
}: {
  icon: typeof Layers;
  label: string;
  sub: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4",
            accent ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-3xl font-bold tabular-nums leading-none",
            accent ? "text-primary" : "text-foreground"
          )}
        >
          {value}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-muted-foreground">
        {sub}
      </p>
    </div>
  );
}

function Panel({
  title,
  sub,
  children,
  className,
  headerAside,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
  headerAside?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/[0.06] bg-white/[0.03] p-4",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div className="leading-tight">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
              {sub}
            </p>
          </div>
        </div>
        {headerAside}
      </div>
      {children}
    </section>
  );
}

const CHART_TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  color: "#fff",
};

const CHART_LEGEND_STYLE = {
  fontSize: 11,
  fontFamily: "var(--font-mono)",
};

function formatCycleDays(value: number | null): string {
  return value == null ? "—" : String(value);
}

function buildCurrentMonthSampleTypeBreakdown(month: {
  specCount: number;
  sampleCount: number;
  finalSampleCount: number;
}) {
  return [
    { type: "终样", value: month.finalSampleCount },
    { type: "样品", value: month.sampleCount },
  ].map(item => {
    return {
      ...item,
      percentage:
        month.specCount === 0
          ? 0
          : ((item.value / month.specCount) * 100).toFixed(0),
    };
  });
}

function orderArchivesBySequence(
  archives: EngineeringSpecLedgerRecord[]
): EngineeringSpecLedgerRecord[] {
  return [...archives].sort((left, right) => {
    const rightSequence = Number(right.sequence) || 0;
    const leftSequence = Number(left.sequence) || 0;
    if (rightSequence !== leftSequence) return rightSequence - leftSequence;
    return String(right.createdAt || "").localeCompare(
      String(left.createdAt || "")
    );
  });
}

function buildCategoryBreakdown(archives: EngineeringSpecLedgerRecord[]) {
  const map = new Map<string, number>();
  archives.forEach(archive => {
    const key = String(archive.category || "").trim() || "未分类";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([type, value], index) => ({ type, value, index }))
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .map(({ type, value }) => ({ type, value }));
}
