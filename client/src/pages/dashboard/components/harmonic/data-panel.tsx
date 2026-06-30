import { HarmonicGlassCard } from "./glass-card";
import type { AlphaMetric, MarginRow, SecondaryStat } from "@/pages/dashboard/lib/harmonic-report";

export function HarmonicAlphaMetricCard({ metrics }: { metrics: AlphaMetric[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">核心指标</h2>
      <div className="flex flex-col gap-8">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="mb-2 text-xs font-medium text-slate-400">{metric.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="bg-gradient-to-br from-[#00F3FF] to-[#0066FF] bg-clip-text text-5xl font-black text-transparent">
                {metric.value}
              </span>
              <span className="text-2xl font-bold text-slate-500">{metric.unit}</span>
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

export function HarmonicSecondaryStatsCard({ stats }: { stats: SecondaryStat[] }) {
  return (
    <HarmonicGlassCard>
      <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">线路参数</h2>
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

export function HarmonicMarginAuditCard({ rows }: { rows: MarginRow[] }) {
  return (
    <HarmonicGlassCard className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">余量审查</h2>
        <span className="text-[10px] uppercase tracking-widest text-slate-600">对照 IEC 限值</span>
      </div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-white/[0.05] py-4 last:border-b-0">
            <div>
            <p className="text-sm font-medium text-slate-200">{row.label}</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
                实测 {row.value}% / 限值 {row.limit}% · 峰值 {row.maxValue}% / 150%限值 {row.maxLimit}%
              </p>
            </div>
            <span className={row.critical ? "text-lg font-black text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]" : "text-lg font-bold text-[#00F3FF]"}>
              {row.margin > 0 ? `+${row.margin}` : row.margin}%
            </span>
          </div>
        ))}
      </div>
    </HarmonicGlassCard>
  );
}
