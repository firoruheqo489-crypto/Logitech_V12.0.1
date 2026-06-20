'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import { cn } from '@/lib/utils'
import type { StudyConfig } from '@/lib/gage-rnr'

interface Props {
  cfg: StudyConfig
  onChange: (operator: number, part: number, trial: number, value: number) => void
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)

export function DataMatrix({ cfg, onChange }: Props) {
  const [active, setActive] = useState(0)
  const [blind, setBlind] = useState(false)
  const safeActive = Math.min(active, cfg.operators - 1)
  const rows = cfg.measurements[safeActive]
  const lastTrial = cfg.trials - 1

  return (
    <GlassPanel>
      <PanelHeader
        title="Data Acquisition Matrix"
        zh="数据采集矩阵"
        subtitle={`${cfg.operators} appraisers · ${cfg.parts} parts · ${cfg.trials} trials — edit any cell to recompute`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setBlind((b) => !b)}
              aria-pressed={blind}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                blind
                  ? 'border-rose-400/40 bg-rose-400/10 text-rose-300'
                  : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200',
              )}
            >
              {blind ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Blind Mode
            </button>
            <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
              {cfg.operatorNames.map((name, o) => (
                <button
                  key={o}
                  onClick={() => setActive(o)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    o === safeActive ? 'bg-sky-400/15 text-sky-300' : 'text-zinc-400 hover:text-zinc-100',
                  )}
                >
                  {name.replace('APPRAISER ', 'OP ')}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="overflow-x-auto px-2 py-2">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-zinc-400">
              <th className="px-3 py-2 text-left font-semibold">Part</th>
              {Array.from({ length: cfg.trials }, (_, t) => (
                <th key={t} className="px-2 py-2 text-center font-semibold">
                  Trial {t + 1}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold text-emerald-400/70">X̄</th>
              <th className="px-3 py-2 text-right font-semibold text-amber-400/70">R</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((trials, p) => {
              const xbar = mean(trials)
              const r = range(trials)
              return (
                <tr key={p} className="border-t border-white/[0.05]">
                  <td className="px-3 py-1.5 font-mono text-xs text-zinc-300">{cfg.partNames[p]}</td>
                  {trials.map((v, t) => {
                    const masked = blind && t < lastTrial
                    return (
                      <td key={t} className="px-1 py-1">
                        <input
                          type="number"
                          step="0.001"
                          value={v}
                          onChange={(e) => onChange(safeActive, p, t, Number.parseFloat(e.target.value) || 0)}
                          className={cn(
                            'w-full rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-center font-mono text-xs text-zinc-50 tabular-nums outline-none transition-all focus:border-sky-400/50 focus:bg-sky-400/[0.06] focus:blur-0',
                            masked && 'blur-[5px] focus:blur-0',
                          )}
                          aria-label={`${cfg.operatorNames[safeActive]} ${cfg.partNames[p]} trial ${t + 1}`}
                        />
                      </td>
                    )
                  })}
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold text-emerald-400 tabular-nums">
                    {xbar.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs font-semibold text-amber-400 tabular-nums">
                    {r.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GlassPanel>
  )
}
