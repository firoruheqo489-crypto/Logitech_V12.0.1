'use client'

import { GlassPanel, PanelHeader } from './glass-panel'
import type { GrrResults, StudyConfig } from './gage-rnr'

export const APPRAISER_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#f472b6', '#a3e635']

const W = 760
const H = 300
const PAD = { top: 20, right: 20, bottom: 36, left: 44 }

export function RunChart({ results, cfg }: { results: GrrResults; cfg: StudyConfig }) {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const values = results.runPoints.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const yMin = lo - span * 0.1
  const yMax = hi + span * 0.1

  const colWidth = innerW / cfg.parts
  // jitter trials slightly within each part column, grouped by appraiser
  const x = (part: number, operator: number, trial: number) => {
    const base = PAD.left + colWidth * (part + 0.5)
    const slots = cfg.operators * cfg.trials
    const slot = operator * cfg.trials + trial
    const jitterW = colWidth * 0.55
    return base + (slot / Math.max(1, slots - 1) - 0.5) * jitterW
  }
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const ticks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin))

  return (
    <GlassPanel>
      <PanelHeader
        title="Run Chart"
        zh="原始数据分布散点图"
        subtitle="Every trial plotted by part · color = appraiser · vertical spread within a part = measurement error"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {cfg.operatorNames.map((name, o) => (
              <span key={o} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: APPRAISER_COLORS[o % APPRAISER_COLORS.length] }} />
                <span className="font-mono text-[10px] text-zinc-300">{name.replace('APPRAISER ', '')}</span>
              </span>
            ))}
          </div>
        }
      />
      <div className="px-3 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Run chart of individual measurement readings">
          {/* gridlines + y ticks */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 font-mono" fontSize="9">
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          {/* part column separators + labels */}
          {Array.from({ length: cfg.parts }, (_, p) => {
            const sepX = PAD.left + colWidth * (p + 1)
            return (
              <g key={p}>
                {p < cfg.parts - 1 && (
                  <line x1={sepX} y1={PAD.top} x2={sepX} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.05)" />
                )}
                <text
                  x={PAD.left + colWidth * (p + 0.5)}
                  y={H - 12}
                  textAnchor="middle"
                  className="fill-zinc-400 font-mono"
                  fontSize="8.5"
                >
                  {cfg.partNames[p]}
                </text>
              </g>
            )
          })}

          {/* readings */}
          {results.runPoints.map((pt, i) => {
            const color = APPRAISER_COLORS[pt.operator % APPRAISER_COLORS.length]
            return (
              <circle
                key={i}
                cx={x(pt.part, pt.operator, pt.trial)}
                cy={y(pt.value)}
                r="2.6"
                fill={color}
                fillOpacity="0.85"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth="0.6"
              >
                <title>
                  {cfg.operatorNames[pt.operator]} · {cfg.partNames[pt.part]} · T{pt.trial + 1}: {pt.value.toFixed(3)}
                </title>
              </circle>
            )
          })}
        </svg>
      </div>
    </GlassPanel>
  )
}
