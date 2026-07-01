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
  CheckCircle2,
  AlertTriangle,
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
  const recentArchives = getRecentSevenDayArchives(archives);
  const total = recentArchives.length;
  const totalPass = recentArchives.filter((item) => item.result === "合格").length;
  const dailyAvg = total === 0 ? "0.0" : (total / 7).toFixed(1);
  const fpy = total === 0 ? "0.0" : ((totalPass / total) * 100).toFixed(1);
  const volumeData = buildDailyVolumeData(recentArchives);
  const typeData = buildTypeBreakdown(recentArchives);
  const typeTotal = typeData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-white/[0.06] bg-white/[0.03] px-5 py-3">
        <h1 className="text-sm font-semibold leading-tight text-slate-100">近 7 天统计看板</h1>
        <p className="font-mono text-[11px] text-slate-400">按最近 7 天规格书归档记录自动汇总</p>
      </header>

      <div className="flex-1 overflow-auto p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard icon={Layers} label="近 7 天处理总数" sub="Total Processed" value={String(total)} unit="份" />
          <KpiCard icon={CalendarDays} label="日均处理量" sub="Daily Average" value={dailyAvg} unit="份/日" />
          <KpiCard icon={Target} label="直通率" sub="First Pass Yield" value={fpy} unit="%" accent />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel title="每日处理量" sub="Recent 7 Days" className="lg:col-span-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="count" name="处理总数" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="pass" name="一次通过" fill="var(--chart-2)" radius={[3, 3, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Legend
              items={[
                { label: "处理总数", color: "var(--chart-1)" },
                { label: "一次通过", color: "var(--chart-2)" },
              ]}
            />
          </Panel>

          <Panel title="产品类别分布" sub="By Product Category">
            <div className="relative h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="type"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {typeData.map((_, index) => (
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
                      color: "var(--popover-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-bold tabular-nums">{typeTotal}</span>
                <span className="font-mono text-[10px] text-muted-foreground">总数</span>
              </div>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {typeData.map((item, index) => (
                <li key={item.type} className="flex items-center gap-2 font-mono text-xs">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
                  />
                  <span className="text-foreground">{item.type}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {item.value} ({typeTotal === 0 ? 0 : ((item.value / typeTotal) * 100).toFixed(0)}%)
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="最近归档记录" sub="Latest 5" className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">产品编号</th>
                  <th className="py-2 pr-4 font-medium">产品类别</th>
                  <th className="py-2 pr-4 font-medium">结果</th>
                  <th className="py-2 pr-4 font-medium">事业部</th>
                  <th className="py-2 font-medium">归档时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {archives.slice(0, 5).map((record) => (
                  <tr key={record.id} className="font-mono text-xs hover:bg-secondary/30">
                    <td className="py-2 pr-4 font-medium text-foreground">{record.sku}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{record.category || "—"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          record.result === "合格" ? "text-emerald-300" : "text-amber-300",
                        )}
                      >
                        {record.result === "合格" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {record.result}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{record.department || "—"}</td>
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
}: {
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-white/[0.06] bg-white/[0.03] p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <div className="leading-tight">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="font-mono text-[10px] tracking-wider text-muted-foreground">{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mt-1 flex items-center gap-4">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
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

function buildTypeBreakdown(archives: EngineeringSpecLedgerRecord[]) {
  const map = new Map<string, number>();
  archives.forEach((archive) => {
    const key = archive.category || "未分类";
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
