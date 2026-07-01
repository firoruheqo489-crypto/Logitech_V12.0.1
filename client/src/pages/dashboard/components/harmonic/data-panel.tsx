import { HarmonicGlassCard } from "./glass-card";
import type { AlphaMetric, MarginRow, ReportInsight, SecondaryStat } from "@/pages/dashboard/lib/harmonic-report";

export function HarmonicAlphaMetricCard({ metrics }: { metrics: AlphaMetric[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">全局控制指标</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="mb-2 text-xs font-medium text-slate-400">{metric.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="bg-gradient-to-br from-[#00F3FF] to-[#0066FF] bg-clip-text text-4xl font-black text-transparent">
                {metric.value}
              </span>
              <span className="text-xl font-bold text-slate-500">{metric.unit}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">{metric.sub}</p>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

const toneColor: Record<SecondaryStat["tone"], string> = {
  good: "text-[#00F3FF]",
  neutral: "text-slate-200",
  critical: "text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]",
};

const insightToneColor: Record<ReportInsight["tone"], string> = {
  good: "text-[#00F3FF]",
  neutral: "text-slate-200",
  critical: "text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]",
};

export function HarmonicSecondaryStatsCard({ stats }: { stats: SecondaryStat[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">基础工况</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[11px] uppercase tracking-wider text-slate-600">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${toneColor[stat.tone]}`}>{stat.value}</p>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicInsightCard({ rows }: { rows: ReportInsight[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">报告判读要点</h2>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-300">{row.label}</span>
              <span className={`font-mono text-lg font-semibold ${insightToneColor[row.tone]}`}>{row.value}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{row.hint}</p>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}

export function HarmonicMarginAuditCard({ rows }: { rows: MarginRow[] }) {
  return (
    <HarmonicGlassCard className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">超标证据链</h2>
        <span className="text-[10px] uppercase tracking-widest text-slate-600">按报告原始限值判定</span>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="border-b border-white/[0.05] py-4 last:border-b-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-200">{row.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  实测 {row.value}% / 限值 {row.limit}% / 峰值 {row.maxValue}% / 峰值限值 {row.maxLimit}%
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  {row.avgMilliamp != null ? `平均谐波电流 ${row.avgMilliamp} mA` : "平均谐波电流 --"}
                  {" / "}
                  {row.limitMilliamp != null ? `100%限值 ${row.limitMilliamp} mA` : "100%限值 --"}
                  {" / "}
                  {row.ratioPercent != null ? `限值占比 ${row.ratioPercent}%` : "限值占比 --"}
                </p>
              </div>
              <span className={row.critical ? "text-lg font-black text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]" : "text-lg font-bold text-[#00F3FF]"}>
                {row.margin > 0 ? `+${row.margin}` : row.margin}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}
