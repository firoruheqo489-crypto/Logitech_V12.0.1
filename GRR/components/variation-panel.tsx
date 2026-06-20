import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults } from '@/lib/gage-rnr'

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
  const max = Math.max(...rows.map((r) => r.pctStudyVar), 1)

  return (
    <GlassPanel className="h-full">
      <PanelHeader
        title="Components of Variation"
        zh="变差分量构成"
        subtitle="% Study Variation (6σ) · contribution to total"
      />
      <div className="space-y-4 px-5 py-5">
        {rows.map((c) => (
          <div key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold tracking-wide text-zinc-200">{c.label}</span>
              <span className={cn('font-mono text-sm font-semibold tabular-nums', textColor[c.key])}>
                {c.pctStudyVar.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className={cn('h-full rounded-full', barColor[c.key])}
                style={{ width: `${(c.pctStudyVar / max) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-400">
              <span>σ {c.stdDev.toFixed(4)}</span>
              <span>contrib {c.pctContribution.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  )
}
