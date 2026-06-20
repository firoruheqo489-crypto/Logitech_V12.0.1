"use client"

import { useMemo } from "react"
import { boxStats } from "@/lib/stats"

interface Props {
  dataA: number[]
  dataB: number[]
}

const W = 300
const H = 150
const PAD_L = 40
const PAD_R = 14
const PAD_T = 14
const PAD_B = 22

export function VarianceBoxplot({ dataA, dataB }: Props) {
  const { rows, xScale, ticks } = useMemo(() => {
    const a = boxStats(dataA)
    const b = boxStats(dataB)
    const lo = Math.min(a.min, b.min)
    const hi = Math.max(a.max, b.max)
    const pad = (hi - lo) * 0.12 || 0.1
    const xMin = lo - pad
    const xMax = hi + pad
    const plotW = W - PAD_L - PAD_R
    const xScale = (v: number) => PAD_L + ((v - xMin) / (xMax - xMin)) * plotW
    const ticks = [xMin, (xMin + xMax) / 2, xMax]
    const rows = [
      {
        box: a,
        cy: PAD_T + 30,
        label: "C1",
        stroke: "oklch(0.86 0.14 200)",
        fill: "oklch(0.82 0.14 200 / 0.16)",
      },
      {
        box: b,
        cy: PAD_T + 82,
        label: "C2",
        stroke: "#FF6B81",
        fill: "oklch(0.62 0.2 18 / 0.16)",
      },
    ]
    return { rows, xScale, ticks }
  }, [dataA, dataB])

  const boxH = 26

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      role="img"
      aria-label="两模腔方差箱线图"
    >
      <defs>
        <filter id="bpGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* vertical gridlines */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={xScale(t)}
          y1={PAD_T}
          x2={xScale(t)}
          y2={H - PAD_B}
          stroke="oklch(0.4 0.02 240 / 0.18)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}

      {rows.map((r) => {
        const { box, cy, stroke, fill, label } = r
        const top = cy - boxH / 2
        return (
          <g key={label}>
            {/* whisker line */}
            <line
              x1={xScale(box.min)}
              y1={cy}
              x2={xScale(box.max)}
              y2={cy}
              stroke={stroke}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.7"
            />
            {/* whisker caps */}
            {[box.min, box.max].map((w, i) => (
              <line
                key={i}
                x1={xScale(w)}
                y1={cy - 6}
                x2={xScale(w)}
                y2={cy + 6}
                stroke={stroke}
                strokeWidth="1.25"
              />
            ))}
            {/* IQR box */}
            <rect
              x={xScale(box.q1)}
              y={top}
              width={Math.max(1, xScale(box.q3) - xScale(box.q1))}
              height={boxH}
              fill={fill}
              stroke={stroke}
              strokeWidth="1.5"
              rx="2"
            />
            {/* glowing median — soft halo */}
            <line
              x1={xScale(box.median)}
              y1={top - 2}
              x2={xScale(box.median)}
              y2={top + boxH + 2}
              stroke={stroke}
              strokeWidth="3"
              filter="url(#bpGlow)"
              opacity="0.55"
            />
            {/* razor-sharp median core */}
            <line
              x1={xScale(box.median)}
              y1={top - 2}
              x2={xScale(box.median)}
              y2={top + boxH + 2}
              stroke={stroke}
              strokeWidth="1.25"
              shapeRendering="crispEdges"
            />
            {/* row label */}
            <text
              x={PAD_L - 8}
              y={cy + 3}
              textAnchor="end"
              className="font-num"
              fontSize="9"
              fill={stroke}
              fontWeight="700"
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* axis ticks */}
      {ticks.map((t, i) => (
        <text
          key={i}
          x={xScale(t)}
          y={H - PAD_B + 14}
          textAnchor="middle"
          className="font-num"
          fontSize="8"
          fill="oklch(0.6 0.012 240)"
        >
          {t.toFixed(2)}
        </text>
      ))}
    </svg>
  )
}
