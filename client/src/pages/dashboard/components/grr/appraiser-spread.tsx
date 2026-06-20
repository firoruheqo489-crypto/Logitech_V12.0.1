'use client'

import { GlassPanel, PanelHeader } from './glass-panel'
import { APPRAISER_COLORS } from './run-chart'
import type { GrrResults, StudyConfig } from './gage-rnr'

export function AppraiserSpread({ results, cfg }: { results: GrrResults; cfg: StudyConfig }) {
  const stats = results.appraiserStats
  const globalMin = Math.min(...stats.map((s) => s.min))
  const globalMax = Math.max(...stats.map((s) => s.max))
  const span = globalMax - globalMin || 1
  const pos = (v: number) => ((v - globalMin) / span) * 100

  return (
    <GlassPanel className="h-full">
      <PanelHeader
        title="Appraiser Spread"
        zh="评价人极差散布"
        subtitle="Min · Avg · Max range per appraiser — divergent bands reveal human bias"
      />
      <div className="space-y-5 px-5 py-5">
        {stats.map((s) => {
          const color = APPRAISER_COLORS[s.operator % APPRAISER_COLORS.length]
          return (
            <div key={s.operator}>
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-100">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {cfg.operatorNames[s.operator]}
                </span>
                <span className="font-mono text-[11px] text-zinc-400">Δ {s.spread.toFixed(3)}</span>
              </div>
              <div className="relative mt-3 h-2 w-full rounded-full bg-white/[0.05]">
                {/* min→max band */}
                <div
                  className="absolute top-0 h-full rounded-full opacity-30"
                  style={{ left: `${pos(s.min)}%`, width: `${pos(s.max) - pos(s.min)}%`, background: color }}
                />
                {/* min / max ticks */}
                <span
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${pos(s.min)}%`, background: color }}
                />
                <span
                  className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full"
                  style={{ left: `${pos(s.max)}%`, background: color }}
                />
                {/* avg marker */}
                <span
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black"
                  style={{ left: `${pos(s.avg)}%`, background: color }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-zinc-400">
                <span>min {s.min.toFixed(3)}</span>
                <span className="text-zinc-100">avg {s.avg.toFixed(3)}</span>
                <span>max {s.max.toFixed(3)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </GlassPanel>
  )
}
