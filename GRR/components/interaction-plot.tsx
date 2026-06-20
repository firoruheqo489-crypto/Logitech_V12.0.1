'use client'

import { GlassPanel, PanelHeader } from '@/components/glass-panel'
import { APPRAISER_COLORS } from '@/components/run-chart'
import type { GrrResults, StudyConfig } from '@/lib/gage-rnr'

const W = 760
const H = 320
const PAD = { top: 20, right: 20, bottom: 40, left: 48 }

export function InteractionPlot({ results, cfg }: { results: GrrResults; cfg: StudyConfig }) {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const allAvgs = results.interactionSeries.flatMap((s) => s.points.map((pt) => pt.avg))
  const lo = Math.min(...allAvgs)
  const hi = Math.max(...allAvgs)
  const span = hi - lo || 1
  const yMin = lo - span * 0.12
  const yMax = hi + span * 0.12

  const x = (part: number) =>
    cfg.parts <= 1 ? PAD.left + innerW / 2 : PAD.left + (part / (cfg.parts - 1)) * innerW
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const ticks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin))

  const interacting = !results.anova.pooled

  return (
    <GlassPanel>
      <PanelHeader
        title="Appraiser × Part Interaction"
        zh="评价人与零件交互作用图"
        subtitle="Parallel lines = no interaction · crossing / diverging lines = significant interaction"
        right={
          <div className="flex flex-wrap items-center gap-2">
            {cfg.operatorNames.map((name, o) => (
              <span key={o} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-3 rounded-sm"
                  style={{ background: APPRAISER_COLORS[o % APPRAISER_COLORS.length] }}
                />
                <span className="font-mono text-[10px] text-zinc-300">{name.replace('APPRAISER ', '')}</span>
              </span>
            ))}
          </div>
        }
      />
      <div className="px-3 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Interaction plot of appraiser cell means across parts"
        >
          {/* gridlines + y ticks */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="rgba(255,255,255,0.06)" />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-zinc-400 font-mono" fontSize="9">
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          {/* x part labels */}
          {Array.from({ length: cfg.parts }, (_, p) => (
            <text
              key={p}
              x={x(p)}
              y={H - 14}
              textAnchor="middle"
              className="fill-zinc-400 font-mono"
              fontSize="8.5"
            >
              {cfg.partNames[p]}
            </text>
          ))}

          {/* one line per appraiser */}
          {results.interactionSeries.map((s) => {
            const color = APPRAISER_COLORS[s.operator % APPRAISER_COLORS.length]
            const d = s.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${x(pt.part)} ${y(pt.avg)}`).join(' ')
            return (
              <g key={s.operator}>
                <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeOpacity="0.9" />
                {s.points.map((pt) => (
                  <circle key={pt.part} cx={x(pt.part)} cy={y(pt.avg)} r="2.8" fill={color}>
                    <title>
                      {cfg.operatorNames[s.operator]} · {cfg.partNames[pt.part]}: {pt.avg.toFixed(3)}
                    </title>
                  </circle>
                ))}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-2.5 text-[10px] leading-relaxed text-zinc-400">
        {interacting ? (
          <span className="text-amber-300">
            Lines diverge — a significant Part × Appraiser interaction is present. // 检测到显著交互作用：不同评价人对特定零件的判读存在系统性差异。
          </span>
        ) : (
          <span className="text-emerald-300">
            Lines are essentially parallel — no significant interaction. // 各评价人曲线基本平行，无显著交互作用。
          </span>
        )}
      </div>
    </GlassPanel>
  )
}
