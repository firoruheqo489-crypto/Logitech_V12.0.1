"use client"

import { useMemo } from "react"
import { mean, std, normalPdf } from "@/lib/stats"

interface Props {
  dataA: number[]
  dataB: number[]
}

const W = 520
const H = 300
const PAD_L = 18
const PAD_R = 18
const PAD_T = 22
const PAD_B = 34

export function DensityOverlay({ dataA, dataB }: Props) {
  const { areaA, areaB, lineA, lineB, ticks, xScale, mA, mB, sep } =
    useMemo(() => {
      const mA = mean(dataA)
      const mB = mean(dataB)
      const sA = std(dataA) || 1e-6
      const sB = std(dataB) || 1e-6

      const lo = Math.min(mA - 4 * sA, mB - 4 * sB)
      const hi = Math.max(mA + 4 * sA, mB + 4 * sB)
      const plotW = W - PAD_L - PAD_R
      const plotH = H - PAD_T - PAD_B
      const xScale = (v: number) => PAD_L + ((v - lo) / (hi - lo)) * plotW

      const N = 120
      const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1))
      const ysA = xs.map((x) => normalPdf(x, mA, sA))
      const ysB = xs.map((x) => normalPdf(x, mB, sB))
      const peak = Math.max(...ysA, ...ysB) || 1
      const yScale = (v: number) => PAD_T + plotH - (v / peak) * plotH

      const toLine = (ys: number[]) =>
        xs.map((x, i) => `${xScale(x).toFixed(2)},${yScale(ys[i]).toFixed(2)}`).join(" ")
      const baseY = PAD_T + plotH
      const toArea = (ys: number[]) =>
        `M ${xScale(xs[0]).toFixed(2)},${baseY} ` +
        xs.map((x, i) => `L ${xScale(x).toFixed(2)},${yScale(ys[i]).toFixed(2)}`).join(" ") +
        ` L ${xScale(xs[N - 1]).toFixed(2)},${baseY} Z`

      const ticks = [lo, (lo + mA) / 2 + 0, (mA + mB) / 2, mB + (hi - mB) / 2, hi]
      // pooled separation in sd units (Cohen's d proxy)
      const pooled = Math.sqrt((sA * sA + sB * sB) / 2) || 1e-6
      const sep = Math.abs(mA - mB) / pooled

      return {
        areaA: toArea(ysA),
        areaB: toArea(ysB),
        lineA: toLine(ysA),
        lineB: toLine(ysB),
        ticks,
        xScale,
        mA,
        mB,
        sep,
      }
    }, [dataA, dataB])

  const baseY = H - PAD_B

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="两模腔真实母体概率密度重叠图"
    >
      <defs>
        <filter id="doGlowC" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="doGlowR" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* baseline */}
      <line
        x1={PAD_L}
        y1={baseY}
        x2={W - PAD_R}
        y2={baseY}
        stroke="oklch(0.4 0.02 240 / 0.3)"
        strokeWidth="1"
      />

      {/* gridlines */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={xScale(t)}
          y1={PAD_T}
          x2={xScale(t)}
          y2={baseY}
          stroke="oklch(0.4 0.02 240 / 0.12)"
          strokeWidth="1"
          strokeDasharray="2 5"
        />
      ))}

      {/* Cavity 2 (red) drawn first so cyan overlaps on top */}
      <path d={areaB} fill="oklch(0.62 0.2 18 / 0.18)" />
      <polyline
        points={lineB}
        fill="none"
        stroke="#FF6B81"
        strokeWidth="2"
        filter="url(#doGlowR)"
      />
      {/* Cavity 1 (cyan) */}
      <path d={areaA} fill="oklch(0.82 0.14 200 / 0.18)" />
      <polyline
        points={lineA}
        fill="none"
        stroke="oklch(0.88 0.14 200)"
        strokeWidth="2"
        filter="url(#doGlowC)"
      />

      {/* mean drop-lines */}
      {[
        { m: mA, c: "oklch(0.88 0.14 200)", label: "μ₁" },
        { m: mB, c: "#FF6B81", label: "μ₂" },
      ].map((d) => (
        <g key={d.label}>
          <line
            x1={xScale(d.m)}
            y1={PAD_T - 4}
            x2={xScale(d.m)}
            y2={baseY}
            stroke={d.c}
            strokeWidth="1.25"
            strokeDasharray="4 3"
            opacity="0.65"
          />
          <text
            x={xScale(d.m)}
            y={PAD_T - 8}
            textAnchor="middle"
            className="font-num"
            fontSize="11"
            fontWeight="700"
            fill={d.c}
          >
            {d.label}
          </text>
        </g>
      ))}

      {/* separation readout */}
      <text
        x={PAD_L + 4}
        y={PAD_T + 14}
        className="font-num"
        fontSize="10"
        fill="oklch(0.82 0.14 200 / 0.85)"
        letterSpacing="0.5"
      >
        {`SEPARATION Δ = ${sep.toFixed(2)} σ`}
      </text>

      {/* x ticks */}
      {ticks.map((t, i) => (
        <text
          key={i}
          x={xScale(t)}
          y={baseY + 16}
          textAnchor="middle"
          className="font-num"
          fontSize="9"
          fill="oklch(0.58 0.012 240)"
        >
          {t.toFixed(2)}
        </text>
      ))}
    </svg>
  )
}
