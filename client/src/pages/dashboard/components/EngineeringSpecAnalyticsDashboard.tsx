"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Layers,
  CalendarDays,
  Target,
  TrendingUp,
} from "lucide-react";

import type { EngineeringSpecLedgerRecord } from "@/lib/engineering-spec-ledger-api";
import { cn } from "@/lib/utils";

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

export function EngineeringSpecAnalyticsDashboard({
  archives,
}: {
  archives: EngineeringSpecLedgerRecord[];
}) {
  const orderedArchives = orderArchivesBySequence(archives);
  const recentArchives = getRecentSevenDayArchives(orderedArchives);
  const total = recentArchives.length;
  const totalSampleOrders = orderedArchives.length;
  const dailyAvg = total === 0 ? "0.0" : (total / 7).toFixed(1);
  const volumeData = buildDailyVolumeData(recentArchives);
  const categoryData = buildCategoryBreakdown(orderedArchives);
  const categoryTotal = categoryData.reduce((sum, item) => sum + item.value, 0);
  const sampleTypeData = buildSampleTypeBreakdown(orderedArchives);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/[0.06] bg-white/[0.03] px-5 py-3">
        <h1 className="text-sm font-semibold leading-tight text-slate-100">近 7 天统计看板</h1>
      </header>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard icon={Layers} label="近 7 天处理总数" sub="Total Processed" value={String(total)} unit="份" />
          <KpiCard icon={CalendarDays} label="日均处理量" sub="Daily Average" value={dailyAvg} unit="份/日" />
          <KpiCard icon={Target} label="总样品单数" sub="Ledger Orders" value={String(totalSampleOrders)} unit="单" accent />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel
            title="每日处理量"
            sub="Recent 7 Days"
            className="lg:col-span-2"
            headerAside={
              <div className="flex items-center gap-3 font-mono text-[11px]">
                {sampleTypeData.map((item) => (
                  <span key={item.type} className="whitespace-nowrap text-muted-foreground">
                    <span className={item.type === "终样" ? "text-cyan-300" : "text-violet-300"}>
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
                <BarChart data={volumeData} margin={{ top: 8, right: 8, left: -16, bottom: 18 }}>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
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
                  <Bar dataKey="count" name="处理总数" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="pass" name="一次通过" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="样品分布" sub="By Product Category">
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="type"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
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
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold tabular-nums">{categoryTotal}</span>
                <span className="font-mono text-[10px] text-muted-foreground">单数</span>
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {categoryData.map((item, index) => (
                <li key={item.type} className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
                  />
                  <span className="text-foreground">{item.type}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {item.value} ({categoryTotal === 0 ? 0 : ((item.value / categoryTotal) * 100).toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="最近归档记录" sub="Latest 5" className="mt-3">
          <div className="h-[286px] overflow-y-auto overflow-x-hidden scrollbar-soft pr-2">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-border bg-[#111111] font-mono text-[10px] tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">产品编号</th>
                  <th className="py-2 pr-4 font-medium">产品类别</th>
                  <th className="py-2 pr-4 font-medium">样品状态</th>
                  <th className="py-2 pr-4 font-medium">产品经理</th>
                  <th className="py-2 font-medium">归档时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orderedArchives.map((record) => (
                  <tr key={record.id} className="font-mono text-xs hover:bg-secondary/30">
                    <td className="py-2 pr-4 font-medium text-foreground">{record.sku}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{record.category || "—"}</td>
                    <td className="py-2 pr-4">{renderAnalyticsSampleStatus(record.sampleType)}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{record.productGroup || "—"}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">{formatTime(record.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", accent ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-3xl font-bold tabular-nums leading-none",
            accent ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{unit}</span>
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-muted-foreground">{sub}</p>
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
    <section className={cn("rounded-lg border border-white/[0.06] bg-white/[0.03] p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <div className="leading-tight">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="font-mono text-[10px] tracking-wider text-muted-foreground">{sub}</p>
          </div>
        </div>
        {headerAside}
      </div>
      {children}
    </section>
  );
}

function buildSampleTypeBreakdown(archives: EngineeringSpecLedgerRecord[]) {
  const total = archives.length;
  return ["终样", "样品"].map((type) => {
    const value = archives.filter((archive) => formatAnalyticsSampleType(archive.sampleType) === type).length;
    return { type, value, percentage: total === 0 ? 0 : ((value / total) * 100).toFixed(0) };
  });
}

function orderArchivesBySequence(archives: EngineeringSpecLedgerRecord[]): EngineeringSpecLedgerRecord[] {
  return [...archives].sort((left, right) => {
    const rightSequence = Number(right.sequence) || 0;
    const leftSequence = Number(left.sequence) || 0;
    if (rightSequence !== leftSequence) return rightSequence - leftSequence;
    return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
  });
}

function getRecentSevenDayArchives(archives: EngineeringSpecLedgerRecord[]) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  return archives.filter((archive) => {
    const createdAt = parseArchiveDate(archive.createdAt);
    return createdAt ? createdAt >= start && createdAt <= end : false;
  });
}

function buildDailyVolumeData(archives: EngineeringSpecLedgerRecord[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const bucket = archives.filter((archive) => {
      const archiveDate = parseArchiveDate(archive.createdAt);
      if (!archiveDate) return false;
      return (
        archiveDate.getFullYear() === date.getFullYear() &&
        archiveDate.getMonth() === date.getMonth() &&
        archiveDate.getDate() === date.getDate()
      );
    });

    return {
      day: `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`,
      count: bucket.length,
      pass: bucket.filter((item) => item.result === "合格").length,
    };
  });
}

function buildCategoryBreakdown(archives: EngineeringSpecLedgerRecord[]) {
  const map = new Map<string, number>();
  archives.forEach((archive) => {
    const key = String(archive.category || "").trim() || "未分类";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([type, value]) => ({ type, value }));
}

function parseArchiveDate(value: string): Date | null {
  if (!value) return null;

  const native = new Date(value);
  if (!Number.isNaN(native.getTime())) {
    return native;
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) return null;

  const [, year, month, day, hours = "00", minutes = "00", seconds = "00"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
}

function formatTime(value: string) {
  const date = parseArchiveDate(value);
  if (!date) return value;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
    date.getHours(),
  ).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderAnalyticsSampleStatus(sampleType?: string) {
  const status = formatAnalyticsSampleType(sampleType);
  if (!status) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("font-medium", status === "终样" ? "text-cyan-300" : "text-violet-300")}>
      {status}
    </span>
  );
}

function formatAnalyticsSampleType(sampleType?: string): string {
  const normalized = String(sampleType || "").trim();
  if (!normalized) return "";
  if (normalized.includes("终样")) return "终样";
  if (normalized.includes("送样") || normalized.includes("样品")) return "样品";
  return normalized;
}
