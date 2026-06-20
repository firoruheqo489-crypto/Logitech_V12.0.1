'use client'

import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import type { ControlChart } from '@/lib/gage-rnr'

interface Props {
  title: string
  zh?: string
  subtitle: string
  chart: ControlChart
  operatorNames: string[]
  /** accent for the connecting line / center line */
  accent?: string
}

const W = 760
const H = 240
const PAD = { top: 24, right: 56, bottom: 28, left: 16 }

export function ControlChartView({
  title,
  zh,
  subtitle,
  chart,
  operatorNames,
  accent = '#38bdf8',
}: Props) {
  const { points, ucl, lcl, centerLine } = chart
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const values = points.map((p) => p.value)
  const lo = Math.min(lcl, ...values)
  const hi = Math.max(ucl, ...values)
  const span = hi - lo || 1
  const padY = span * 0.12
  const yMin = lo - padY
  const yMax = hi + padY

  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.index)} ${y(p.value)}`).join(' ')

  return (
    <GlassPanel>
      <PanelHeader title={title} zh={zh} subtitle={subtitle} />
      <div className="px-3 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} control chart`}>
          {/* operator subgroup separators + labels */}
          {chart.operatorStarts.map((start, oi) => {
            const end = chart.operatorStarts[oi + 1] ?? points.length
            const midIndex = (start + end - 1) / 2
            const sepX = oi === 0 ? null : x(start) - (x(1) - x(0)) / 2
            return (
              <g key={oi}>
                {sepX !== null && (
                  <line x1={sepX} y1={PAD.top - 6} x2={sepX} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.10)" strokeDasharray="3 4" />
                )}
                <text x={x(midIndex)} y={H - 8} textAnchor="middle" className="fill-zinc-400 font-mono" fontSize="9" letterSpacing="1">
                  {operatorNames[oi]}
                </text>
              </g>
            )
          })}

          {/* control limit lines */}
          <line x1={PAD.left} y1={y(ucl)} x2={W - PAD.right} y2={y(ucl)} stroke="#fb7185" strokeWidth="1" strokeDasharray="5 4" opacity="0.7" />
          <text x={W - PAD.right + 6} y={y(ucl) + 3} className="fill-rose-400 font-mono" fontSize="9">
            UCL
          </text>

          <line x1={PAD.left} y1={y(centerLine)} x2={W - PAD.right} y2={y(centerLine)} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          <text x={W - PAD.right + 6} y={y(centerLine) + 3} className="fill-zinc-400 font-mono" fontSize="9">
            CL
          </text>

          {(() => {
            // Always draw an LCL reference. When the limit sits at the floor
            // (LCL ≈ 0, typical for R charts) render it fainter in cyan to
            // satisfy Six Sigma charting without implying an out-of-control risk.
            const isFloor = lcl <= 1e-9
            const stroke = isFloor ? '#22d3ee' : '#fb7185'
            const op = isFloor ? 0.45 : 0.7
            const labelCls = isFloor ? 'fill-cyan-300/80' : 'fill-rose-400'
            return (
              <>
                <line x1={PAD.left} y1={y(lcl)} x2={W - PAD.right} y2={y(lcl)} stroke={stroke} strokeWidth="1" strokeDasharray="4 5" opacity={op} />
                <text x={W - PAD.right + 6} y={y(lcl) + 3} className={`${labelCls} font-mono`} fontSize="9">
                  {isFloor ? `LCL ${lcl.toFixed(3)}` : 'LCL'}
                </text>
              </>
            )
          })()}

          {/* connecting line */}
          <path d={linePath} fill="none" stroke={accent} strokeWidth="1.5" opacity="0.85" />

          {/* points */}
          {points.map((p) => (
            <circle
              key={p.index}
              cx={x(p.index)}
              cy={y(p.value)}
              r={p.outOfControl ? 4 : 2.8}
              fill={p.outOfControl ? '#fb7185' : accent}
              stroke={p.outOfControl ? '#fb7185' : 'rgba(0,0,0,0.4)'}
              strokeWidth="1"
            >
              <title>
                {operatorNames[p.operator]} · part {p.part + 1}: {p.value.toFixed(3)}
              </title>
            </circle>
          ))}
        </svg>
      </div>
    </GlassPanel>
  )
}
