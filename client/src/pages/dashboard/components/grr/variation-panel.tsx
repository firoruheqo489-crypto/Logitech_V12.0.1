import { GlassPanel, PanelHeader } from './glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults } from './gage-rnr'

const barColor: Record<string, string> = {
  EV: 'bg-sky-400',
  AV: 'bg-indigo-400',
  PV: 'bg-emerald-400',
  GRR: 'bg-amber-400',
}
const textColor: Record<string, string> = {
  EV: 'text-sky-400',
  AV: 'text-indigo-400',
  PV: 'text-emerald-400',
  GRR: 'text-amber-400',
}

export function VariationPanel({ results }: { results: GrrResults }) {
  const rows = [results.grr, ...results.components]
  const max = Math.max(...rows.map((row) => row.pctStudyVar), 1)

  return (
    <GlassPanel className="h-full">
      <PanelHeader
        title="Components of Variation"
        zh="变差分量构成"
        subtitle="% Study Variation (6σ) · contribution to total"
      />
      <div className="space-y-3 px-5 py-5">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-white/15 bg-white/[0.02] px-3 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-wide text-zinc-200">{row.label}</span>
              <span className={cn('font-mono text-sm font-semibold tabular-nums', textColor[row.key])}>
                {row.pctStudyVar.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={cn('h-full rounded-full', barColor[row.key])}
                style={{ width: `${(row.pctStudyVar / max) * 100}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-mono text-[10px] text-zinc-400">
              <span>σ {row.stdDev.toFixed(4)}</span>
              <span>contrib {row.pctContribution.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
