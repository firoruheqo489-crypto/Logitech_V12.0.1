import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults } from '@/lib/gage-rnr'

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
        subtitle="AIAG X̄ & R method · 6σ study variation"
      />
      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
              <th className="px-4 py-2.5 text-left font-semibold">Source</th>
              <th className="px-3 py-2.5 text-right font-semibold">Std Dev (σ)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Study Var (6σ)</th>
              <th className="px-3 py-2.5 text-right font-semibold">% Contrib</th>
              <th className="px-3 py-2.5 text-right font-semibold">% Study Var</th>
              <th className="px-4 py-2.5 text-right font-semibold">% Tol</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs tabular-nums">
            {rows.map((r) => (
              <tr
                key={r.key}
                className={cn(
                  'border-t border-white/[0.05]',
                  r.key === 'GRR' && 'bg-amber-400/[0.04]',
                  r.key === 'TV' && 'bg-white/[0.03]',
                )}
              >
                <td className={cn('px-4 py-2.5 text-left font-semibold', accent[r.key] ?? 'text-zinc-300')}>
                  {r.label}
                </td>
                <td className="px-3 py-2.5 text-right text-zinc-300">{r.stdDev.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-right text-zinc-300">{r.studyVar.toFixed(4)}</td>
                <td className="px-3 py-2.5 text-right text-zinc-400">{r.pctContribution.toFixed(2)}</td>
                <td className={cn('px-3 py-2.5 text-right font-semibold', accent[r.key] ?? 'text-zinc-200')}>
                  {r.pctStudyVar.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-400">{r.pctTolerance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  )
}
