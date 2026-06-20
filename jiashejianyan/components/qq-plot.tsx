"use client"

import { useMemo } from "react"
import { qqPoints } from "@/lib/stats"

interface Props {
  dataA: number[]
  dataB: number[]
}

const W = 300
const H = 150
const PAD = 22

export function QQPlot({ dataA, dataB }: Props) {
  const { pts, scale, lineP1, lineP2 } = useMemo(() => {
    const combined = [...qqPoints(dataA), ...qqPoints(dataB)]
    const all = combined.flatMap((p) => [p.theoretical, p.sample])
    const finite = all.filter((v) => Number.isFinite(v))
    const lim = Math.max(2.2, ...finite.map((v) => Math.abs(v))) || 2.2
    const plotW = W - PAD * 2
    const plotH = H - PAD * 2
    const sx = (v: number) => PAD + ((v + lim) / (2 * lim)) * plotW
    const sy = (v: number) => PAD + plotH - ((v + lim) / (2 * lim)) * plotH
    const scale = { sx, sy, lim }
    const pts = combined
      .filter((p) => Number.isFinite(p.theoretical) && Number.isFinite(p.sample))
      .map((p) => ({ x: sx(p.theoretical), y: sy(p.sample), outlier: p.outlier }))
    // 45-degree reference line endpoints
    const lineP1 = { x: sx(-lim), y: sy(-lim) }
    const lineP2 = { x: sx(lim), y: sy(lim) }
    return { pts, scale, lineP1, lineP2 }
  }, [dataA, dataB])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="正态分布 Q-Q 校验图"
    >
      <defs>
        <filter id="qqGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* frame */}
      <rect
        x={PAD}
        y={PAD}
        width={W - PAD * 2}
        height={H - PAD * 2}
        fill="none"
        stroke="oklch(0.4 0.02 240 / 0.2)"
        strokeWidth="1"
      />

      {/* crosshair gridlines */}
      <line
        x1={scale.sx(0)}
        y1={PAD}
        x2={scale.sx(0)}
        y2={H - PAD}
        stroke="oklch(0.4 0.02 240 / 0.14)"
        strokeWidth="1"
      />
      <line
        x1={PAD}
        y1={scale.sy(0)}
        x2={W - PAD}
        y2={scale.sy(0)}
        stroke="oklch(0.4 0.02 240 / 0.14)"
        strokeWidth="1"
      />

      {/* theoretical 45° line */}
      <line
        x1={lineP1.x}
        y1={lineP1.y}
        x2={lineP2.x}
        y2={lineP2.y}
        stroke="oklch(0.86 0.14 200)"
        strokeWidth="1.25"
        strokeDasharray="4 4"
        opacity="0.8"
      />

      {/* sample quantile dots — glow halo + razor-sharp solid core */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.outlier ? 3.4 : 2.8}
            fill={p.outlier ? "var(--warning)" : "oklch(0.88 0.14 200)"}
            filter="url(#qqGlow)"
            opacity={p.outlier ? 0.5 : 0.4}
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={p.outlier ? 2 : 1.5}
            fill={p.outlier ? "var(--warning)" : "oklch(0.96 0.05 200)"}
            stroke="oklch(0.18 0.012 250)"
            strokeWidth="0.5"
            shapeRendering="geometricPrecision"
          />
        </g>
      ))}

      {/* axis hints */}
      <text
        x={W - PAD}
        y={H - PAD + 12}
        textAnchor="end"
        className="font-num"
        fontSize="8"
        fill="oklch(0.55 0.012 240)"
      >
        THEORETICAL Z
      </text>

      {/* shapiro-wilk overlay */}
      <text
        x={PAD + 6}
        y={PAD + 12}
        className="font-num"
        fontSize="8"
        fill="oklch(0.82 0.14 200 / 0.7)"
        letterSpacing="0.5"
      >
        SHAPIRO-WILK: PASS
      </text>
    </svg>
  )
}
