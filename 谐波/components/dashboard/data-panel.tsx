import { GlassCard } from "./glass-card"
import type { AlphaMetric, MarginRow, SecondaryStat } from "@/lib/power-data"

export function AlphaMetricCard({ metrics }: { metrics: AlphaMetric[] }) {
  return (
    <GlassCard>
      <h2 className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
        Alpha Metrics
      </h2>
      <div className="flex flex-col gap-8">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="mb-2 text-xs font-medium text-slate-400">{m.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="bg-gradient-to-br from-[#00F3FF] to-[#0066FF] bg-clip-text text-5xl font-black text-transparent">
                {m.value}
              </span>
              <span className="text-2xl font-bold text-slate-500">{m.unit}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-600">{m.sub}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

const toneColor: Record<SecondaryStat["tone"], string> = {
  good: "text-[#00F3FF]",
  neutral: "text-slate-200",
  critical: "text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]",
}

export function SecondaryStatsCard({ stats }: { stats: SecondaryStat[] }) {
  return (
    <GlassCard>
      <h2 className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
        Line Parameters
      </h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[11px] uppercase tracking-wider text-slate-600">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${toneColor[s.tone]}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

export function MarginAuditCard({ rows }: { rows: MarginRow[] }) {
  return (
    <GlassCard className="flex-1">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          Margin Audit
        </h2>
        <span className="text-[10px] uppercase tracking-widest text-slate-600">vs IEC limit</span>
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between border-b border-white/[0.05] py-4 last:border-b-0"
          >
            <div>
              <p className="text-sm font-medium text-slate-200">{r.label}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {r.value}% measured / {r.limit}% allowed
              </p>
            </div>
            <span
              className={
                r.critical
                  ? "text-lg font-black text-[#FF003C] drop-shadow-[0_0_8px_rgba(255,0,60,0.8)]"
                  : "text-lg font-bold text-[#00F3FF]"
              }
            >
              {r.margin > 0 ? `+${r.margin}` : r.margin}%
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
