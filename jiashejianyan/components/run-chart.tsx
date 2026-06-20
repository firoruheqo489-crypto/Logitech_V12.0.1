"use client"

import { useMemo } from "react"
import { mean } from "@/lib/stats"

interface Props {
  dataA: number[]
  dataB: number[]
}

const W = 300
const H = 150
const PAD_L = 34
const PAD_R = 12
const PAD_T = 16
const PAD_B = 22

export function RunChart({ dataA, dataB }: Props) {
  const { seriesA, seriesB, ptsA, ptsB, yTicks, xCount, yScale, xScale } =
    useMemo(() => {
      const xCount = Math.max(dataA.length, dataB.length, 2)
      const all = [...dataA, ...dataB]
      const lo = Math.min(...all)
      const hi = Math.max(...all)
      const pad = (hi - lo) * 0.18 || 0.05
      const yMin = lo - pad
      const yMax = hi + pad
      const plotW = W - PAD_L - PAD_R
      const plotH = H - PAD_T - PAD_B

      const xScale = (i: number) =>
        PAD_L + (xCount <= 1 ? 0 : (i / (xCount - 1)) * plotW)
      const yScale = (v: number) =>
        PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH

      const toPts = (xs: number[]) =>
        xs.map((v, i) => ({ x: xScale(i), y: yScale(v) }))
      const toLine = (pts: { x: number; y: number }[]) =>
        pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")

      const ptsA = toPts(dataA)
      const ptsB = toPts(dataB)
      const yTicks = [yMax, (yMin + yMax) / 2, yMin]

      return {
        seriesA: toLine(ptsA),
        seriesB: toLine(ptsB),
        ptsA,
        ptsB,
        yTicks,
        xCount,
        yScale,
        xScale,
      }
    }, [dataA, dataB])

  const meanA = mean(dataA)
  const meanB = mean(dataB)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="过程稳定性运行图"
    >
      <defs>
        <filter id="rcGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* horizontal gridlines + y ticks */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L}
            y1={yScale(t)}
            x2={W - PAD_R}
            y2={yScale(t)}
            stroke="oklch(0.4 0.02 240 / 0.14)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text
            x={PAD_L - 6}
            y={yScale(t) + 3}
            textAnchor="end"
            className="font-num"
            fontSize="7.5"
            fill="oklch(0.55 0.012 240)"
          >
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {/* center reference lines (process means) */}
      <line
        x1={PAD_L}
        y1={yScale(meanA)}
        x2={W - PAD_R}
        y2={yScale(meanA)}
        stroke="oklch(0.82 0.14 200 / 0.35)"
        strokeWidth="1"
        strokeDasharray="5 4"
      />
      <line
        x1={PAD_L}
        y1={yScale(meanB)}
        x2={W - PAD_R}
        y2={yScale(meanB)}
        stroke="oklch(0.62 0.2 18 / 0.4)"
        strokeWidth="1"
        strokeDasharray="5 4"
      />

      {/* run lines */}
      <polyline
        points={seriesB}
        fill="none"
        stroke="#FF6B81"
        strokeWidth="1.5"
        filter="url(#rcGlow)"
        opacity="0.9"
      />
      <polyline
        points={seriesA}
        fill="none"
        stroke="oklch(0.88 0.14 200)"
        strokeWidth="1.5"
        filter="url(#rcGlow)"
      />

      {/* sample dots */}
      {ptsB.map((p, i) => (
        <circle key={`b${i}`} cx={p.x} cy={p.y} r="2" fill="#FF6B81" />
      ))}
      {ptsA.map((p, i) => (
        <circle
          key={`a${i}`}
          cx={p.x}
          cy={p.y}
          r="2"
          fill="oklch(0.9 0.14 200)"
          filter="url(#rcGlow)"
        />
      ))}

      {/* x-axis sample-order ticks */}
      {Array.from({ length: xCount }, (_, i) => (
        <text
          key={i}
          x={xScale(i)}
          y={H - PAD_B + 14}
          textAnchor="middle"
          className="font-num"
          fontSize="7"
          fill="oklch(0.5 0.012 240)"
        >
          {i + 1}
        </text>
      ))}
    </svg>
  )
}
