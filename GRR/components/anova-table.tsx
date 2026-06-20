'use client'

import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import { cn } from '@/lib/utils'
import type { GrrResults } from '@/lib/gage-rnr'

const fmt = (v: number | null, digits: number) =>
  v === null || !Number.isFinite(v) ? '—' : v.toFixed(digits)

/** Format a p-value with the conventional < .001 floor. */
function fmtP(p: number | null) {
  if (p === null || !Number.isFinite(p)) return '—'
  if (p < 0.001) return '<0.001'
  return p.toFixed(3)
}

export function AnovaTable({ results }: { results: GrrResults }) {
  const { anova } = results

  return (
    <GlassPanel>
      <PanelHeader
        title="ANOVA Statistics"
        zh="方差分析统计表"
        subtitle="Two-Way ANOVA with interaction · Part × Appraiser · F-test"
        right={
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider',
              anova.pooled
                ? 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300'
                : 'border-amber-400/30 bg-amber-400/10 text-amber-300',
            )}
          >
            {anova.pooled ? 'INTERACTION POOLED' : 'INTERACTION RETAINED'}
          </span>
        }
      />
      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
              <th className="px-3 py-2 text-left font-semibold">Source // 来源</th>
              <th className="px-3 py-2 text-right font-semibold">DF</th>
              <th className="px-3 py-2 text-right font-semibold">SS</th>
              <th className="px-3 py-2 text-right font-semibold">MS</th>
              <th className="px-3 py-2 text-right font-semibold">F</th>
              <th className="px-3 py-2 text-right font-semibold">P</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs tabular-nums">
            {anova.rows.map((row) => {
              const isTotal = row.key === 'TOTAL'
              const significant = row.p !== null && row.p < anova.alpha
              return (
                <tr
                  key={row.key}
                  className={cn(
                    'border-t border-white/[0.06]',
                    isTotal && 'border-t-white/15 font-semibold text-zinc-100',
                  )}
                >
                  <td className="px-3 py-2 text-left text-[11px] font-medium not-italic text-zinc-200">{row.label}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">{row.df}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">{fmt(row.ss, 4)}</td>
                  <td className="px-3 py-2 text-right text-zinc-300">{fmt(row.ms, 4)}</td>
                  <td className="px-3 py-2 text-right text-zinc-100">{fmt(row.f, 3)}</td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right',
                      row.p === null ? 'text-zinc-500' : significant ? 'text-emerald-300' : 'text-rose-300',
                    )}
                  >
                    {fmtP(row.p)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-400">
        {anova.pooled ? (
          <>
            Interaction P = {fmtP(anova.interactionP)} ≥ α = {anova.alpha.toFixed(2)} → pooled into Repeatability per
            AIAG. // 交互项 P 值 ≥ α，按 AIAG 规则并入重复性误差项。
          </>
        ) : (
          <>
            Interaction P = {fmtP(anova.interactionP)} {'<'} α = {anova.alpha.toFixed(2)} → retained as a significant
            term. // 交互项显著，予以保留并计入再现性。
          </>
        )}
      </div>
    </GlassPanel>
  )
}
