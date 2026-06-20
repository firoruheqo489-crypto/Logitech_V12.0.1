"use client"

import { useMemo } from "react"
import { tPdf } from "@/lib/stats"
import { StackedLabel } from "@/components/stacked-label"

interface Props {
  tStat: number
  df: number
  critical: number
  reject: boolean
  bare?: boolean
}

const W = 820
const H = 340
const PAD_X = 36
const PAD_TOP = 28
const PAD_BOTTOM = 40

export function DistributionCurve({ tStat, df, critical, reject, bare }: Props) {
  const domain = useMemo(() => {
    const m = Math.max(4.2, Math.abs(tStat) + 1.2, critical + 1)
    return [-m, m] as const
  }, [tStat, critical])

  const { curvePath, leftTail, rightTail, peak, xScale, yForX } =
    useMemo(() => {
      const [xMin, xMax] = domain
      const N = 240
      const xs: number[] = []
      const ys: number[] = []
      let maxY = 0
      for (let i = 0; i <= N; i++) {
        const x = xMin + ((xMax - xMin) * i) / N
        const y = tPdf(x, df)
        xs.push(x)
        ys.push(y)
        if (y > maxY) maxY = y
      }
      const plotW = W - PAD_X * 2
      const plotH = H - PAD_TOP - PAD_BOTTOM
      const xScale = (x: number) =>
        PAD_X + ((x - xMin) / (xMax - xMin)) * plotW
      const yScale = (y: number) => PAD_TOP + plotH - (y / maxY) * plotH
      const yForX = (x: number) => yScale(tPdf(x, df))

      const pts = xs.map((x, i) => `${xScale(x)},${yScale(ys[i])}`)
      const curvePath = `M ${pts.join(" L ")}`

      const baseY = PAD_TOP + plotH

      function tailPath(from: number, to: number) {
        const steps = 60
        const seg: string[] = []
        for (let i = 0; i <= steps; i++) {
          const x = from + ((to - from) * i) / steps
          seg.push(`${xScale(x)},${yScale(tPdf(x, df))}`)
        }
        return `M ${xScale(from)},${baseY} L ${seg.join(" L ")} L ${xScale(
          to,
        )},${baseY} Z`
      }

      const leftTail = tailPath(xMin, -critical)
      const rightTail = tailPath(critical, xMax)
      const peak = { x: xScale(0), y: yScale(maxY) }

      return { curvePath, leftTail, rightTail, peak, xScale, yForX }
    }, [domain, df, critical])

  const baseY = H - PAD_BOTTOM
  const statX = xScale(tStat)
  const statTopY = yForX(tStat)
  const inRejection = Math.abs(tStat) >= critical

  const ticks = [-critical, 0, critical]

  const inner = (
    <>
      <header className="mb-2 flex items-center justify-between">
        <StackedLabel zh="抽样分布" en="Sampling Distribution · t(df)" />
        <div className="flex items-center gap-4">
          <Legend color="#FF003C" zh="拒绝域" en="α tails" />
          <Legend color="var(--primary)" zh="检验统计量" en="T-Stat" filled />
        </div>
      </header>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="正态分布钟形曲线与检验统计量位置"
      >
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.82 0.14 200)" stopOpacity="0.4" />
            <stop offset="55%" stopColor="oklch(0.82 0.14 200)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="oklch(0.82 0.14 200)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="tailFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF003C" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF003C" stopOpacity="0.12" />
          </linearGradient>
          {/* warning diagonal stripes for rejection zones */}
          <pattern
            id="hazardStripes"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="8" height="8" fill="#FF003C" fillOpacity="0.12" />
            <rect width="3" height="8" fill="#FF003C" fillOpacity="0.4" />
          </pattern>
          <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowOrb" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid baseline */}
        <line
          x1={PAD_X}
          y1={baseY}
          x2={W - PAD_X}
          y2={baseY}
          stroke="oklch(0.5 0.02 240 / 0.3)"
          strokeWidth="1"
        />

        {/* area under curve */}
        <path
          d={`${curvePath} L ${W - PAD_X},${baseY} L ${PAD_X},${baseY} Z`}
          fill="url(#curveFill)"
        />

        {/* critical region tails — gradient + hazard stripes */}
        <path d={leftTail} fill="url(#tailFill)" />
        <path d={leftTail} fill="url(#hazardStripes)" />
        <path d={rightTail} fill="url(#tailFill)" />
        <path d={rightTail} fill="url(#hazardStripes)" />

        {/* critical boundary lines */}
        {[-critical, critical].map((c) => (
          <line
            key={c}
            x1={xScale(c)}
            y1={PAD_TOP}
            x2={xScale(c)}
            y2={baseY}
            stroke="#FF003C"
            strokeOpacity="0.7"
            strokeWidth="1.25"
            strokeDasharray="3 4"
          />
        ))}

        {/* the bell curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="oklch(0.86 0.14 200)"
          strokeWidth="2.5"
          filter="url(#glowLine)"
          strokeLinejoin="round"
        />

        {/* mean marker */}
        <line
          x1={peak.x}
          y1={peak.y}
          x2={peak.x}
          y2={baseY}
          stroke="oklch(0.6 0.02 240 / 0.4)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* test statistic — vertical laser beam from top to axis */}
        <line
          x1={statX}
          y1={PAD_TOP - 8}
          x2={statX}
          y2={baseY}
          stroke={inRejection ? "#FF003C" : "oklch(0.86 0.14 200)"}
          strokeWidth="2"
          strokeDasharray="4 4"
          filter="url(#glowLine)"
          className="animate-pulse-line"
        />
        {/* throbbing orb at the curve intersection */}
        {inRejection && (
          <circle
            cx={statX}
            cy={statTopY}
            r="14"
            fill="#FF003C"
            opacity="0.3"
            className="animate-orb-pulse"
            style={{ transformOrigin: `${statX}px ${statTopY}px` }}
          />
        )}
        <circle
          cx={statX}
          cy={statTopY}
          r={inRejection ? 6.5 : 4.5}
          fill={inRejection ? "#FF003C" : "oklch(0.86 0.14 200)"}
          filter={inRejection ? "url(#glowOrb)" : "url(#glowLine)"}
        >
          {inRejection && (
            <animate
              attributeName="r"
              values="6;8.5;6"
              dur="1.4s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <g>
          <rect
            x={statX - 38}
            y={statTopY - 42}
            width="76"
            height="22"
            rx="5"
            fill="oklch(0.16 0.012 250 / 0.9)"
            stroke={
              inRejection
                ? "#FF003C"
                : "oklch(0.86 0.14 200 / 0.6)"
            }
          />
          <text
            x={statX}
            y={statTopY - 27}
            textAnchor="middle"
            className="font-num"
            fontSize="12"
            fontWeight="700"
            fill={inRejection ? "#FF003C" : "oklch(0.88 0.14 200)"}
          >
            T = {tStat.toFixed(2)}
          </text>
        </g>

        {/* x-axis ticks */}
        {ticks.map((t, i) => (
          <text
            key={i}
            x={xScale(t)}
            y={baseY + 22}
            textAnchor="middle"
            className="font-num"
            fontSize="11"
            fill="oklch(0.66 0.012 240)"
          >
            {t === 0 ? "0" : `${t > 0 ? "+" : ""}${t.toFixed(2)}`}
          </text>
        ))}
      </svg>
    </>
  )

  if (bare) return inner

  return <section className="metal-panel rounded-2xl p-5">{inner}</section>
}

function Legend({
  color,
  zh,
  en,
  filled,
}: {
  color: string
  zh: string
  en: string
  filled?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-sm"
        style={{
          background: filled ? color : "transparent",
          border: `1.5px solid ${color}`,
        }}
      />
      <div className="flex flex-col leading-none">
        <span className="text-[11px] font-medium text-foreground">{zh}</span>
        <span className="font-num text-[9px] uppercase tracking-wider text-muted-foreground">
          {en}
        </span>
      </div>
    </div>
  )
}
