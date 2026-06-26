import { GlassPanel, PanelHeader } from './glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults } from './gage-rnr'

const accent: Record<string, string> = {
  EV: 'text-sky-400',
  AV: 'text-indigo-400',
  PV: 'text-emerald-400',
  GRR: 'text-amber-400',
  TV: 'text-zinc-100',
}

export function SummaryTable({ results }: { results: GrrResults }) {
  const [ev, av, pv] = results.components
  const rows = [
    { ...results.grr, key: 'GRR' },
    ev,
    av,
    pv,
    {
      key: 'TV',
      label: 'Total Variation (TV) // 总变差',
      stdDev: results.totalVariation / 6,
      studyVar: results.totalVariation,
      pctStudyVar: 100,
      pctContribution: 100,
      pctTolerance: results.grr.pctTolerance * (results.totalVariation / (results.grr.studyVar || 1)),
    },
  ]

  return (
    <GlassPanel>
      <PanelHeader
        title="Variance Decomposition"
        zh="方差分解"
        subtitle="AIAG X-bar & R method · 6σ study variation"
      />
      <div className="overflow-x-auto px-3 py-3">
        <div className="overflow-hidden rounded-xl border border-white/20 bg-white/[0.02]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/30 text-[10px] uppercase tracking-widest text-zinc-400">
                <th className="border-r border-white/12 px-4 py-3 text-left font-semibold">Source</th>
                <th className="border-r border-white/12 px-3 py-3 text-right font-semibold">Std Dev (σ)</th>
                <th className="border-r border-white/12 px-3 py-3 text-right font-semibold">Study Var (6σ)</th>
                <th className="border-r border-white/12 px-3 py-3 text-right font-semibold">% Contrib</th>
                <th className="border-r border-white/12 px-3 py-3 text-right font-semibold">% Study Var</th>
                <th className="px-4 py-3 text-right font-semibold">% Tol</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs tabular-nums">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={cn(
                    'border-t border-white/15',
                    row.key === 'GRR' && 'bg-amber-400/[0.04]',
                    row.key === 'TV' && 'bg-white/[0.03]',
                  )}
                >
                  <td className={cn('border-r border-white/10 px-4 py-3 text-left font-semibold', accent[row.key] ?? 'text-zinc-300')}>
                    {row.label}
                  </td>
                  <td className="border-r border-white/10 px-3 py-3 text-right text-zinc-300">{row.stdDev.toFixed(4)}</td>
                  <td className="border-r border-white/10 px-3 py-3 text-right text-zinc-300">{row.studyVar.toFixed(4)}</td>
                  <td className="border-r border-white/10 px-3 py-3 text-right text-zinc-400">{row.pctContribution.toFixed(2)}</td>
                  <td className={cn('border-r border-white/10 px-3 py-3 text-right font-semibold', accent[row.key] ?? 'text-zinc-200')}>
                    {row.pctStudyVar.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{row.pctTolerance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </GlassPanel>
  )
}
