"use client"

import { cn } from "@/lib/utils"
import { ArrowUp, ArrowDown } from "lucide-react"

interface ToleranceMapProps {
  nominal: number
  actual: number  // This is now the calculated mean from cavity data
  usl: number
  lsl: number
  unit: string
  stdDev: number   // Standard deviation from cavity measurements
  range: number    // Max - Min from cavity measurements
  ppk: number      // Process Performance Index
}

type ToleranceVisualStatus = "pass" | "warning" | "high" | "low"

export function ToleranceMap({ 
  nominal, 
  actual, 
  usl, 
  lsl, 
  unit,
  stdDev,
  range: measuredRange,
  ppk,
}: ToleranceMapProps) {
  const toleranceRange = usl - lsl
  const lslBoundaryPos = 15
  const uslBoundaryPos = 85
  const warningLowPercent = 30
  const warningHighPercent = 70
  const inTolSpan = uslBoundaryPos - lslBoundaryPos
  // Position as percentage within the tolerance band
  const posPercent = ((actual - lsl) / toleranceRange) * 100
  const nominalPercent = ((nominal - lsl) / toleranceRange) * 100
  // Project value into the bar where in-tolerance maps to [15%, 85%].
  const actualBarPos = (posPercent / 100) * inTolSpan + lslBoundaryPos
  const nominalPos = (nominalPercent / 100) * inTolSpan + lslBoundaryPos
  const clampedPos = Math.max(2, Math.min(98, actualBarPos))

  const isInTolerance = actual >= lsl && actual <= usl
  const isWarningInTolerance = isInTolerance && (posPercent < warningLowPercent || posPercent > warningHighPercent)
  const toleranceStatus: ToleranceVisualStatus = actual > usl ? "high" : actual < lsl ? "low" : isWarningInTolerance ? "warning" : "pass"

  const statusPillClass = {
    pass: "bg-emerald-400/15 text-emerald-300",
    warning: "bg-amber-400/20 text-amber-300",
    high: "bg-rose-500/15 text-rose-300",
    low: "bg-blue-500/15 text-blue-500",
  } as const

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Title */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase font-mono">
          TOLERANCE MAP
        </h3>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-bold font-mono",
            statusPillClass[toleranceStatus]
          )}
        >
          {isInTolerance ? "IN TOL" : "OUT OF TOL"}
        </span>
      </div>

      {/* Metrics Row: 6 cards - 标准值, 上限值, 下限值, 实测均值, σ, Range */}
      <div
        className="mb-5 w-full"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: "1rem",
        }}
      >
        <MetricCard label="标准值 / NOM" value={nominal.toFixed(3)} unit={unit} />
        <MetricCard label="上限值 / USL" value={usl.toFixed(3)} unit={unit} />
        <MetricCard label="下限值 / LSL" value={lsl.toFixed(3)} unit={unit} />
        <MetricCard 
          label="实测均值 / X̄" 
          value={actual.toFixed(4)} 
          unit={unit} 
          highlight 
          status={toleranceStatus}
        />
        <MetricCard 
          label="标准差 / σ" 
          value={stdDev.toFixed(4)} 
          unit={unit}
        />
        <MetricCard 
          label="极差 / Range" 
          value={measuredRange.toFixed(4)} 
          unit={unit}
        />
      </div>

      {/* Tolerance Bar */}
      <div className="relative">
        {/* Top label */}
        <div className="relative mb-2 h-5 text-xs font-mono">
          <span
            className="absolute -translate-x-1/2 text-muted-foreground"
            style={{ left: `${nominalPos}%` }}
          >
            NOMINAL {nominal.toFixed(3)}
          </span>
        </div>

        {/* Flat high-contrast ruler */}
        <div className="relative h-10">
          <div className="relative w-full h-3 bg-slate-800 rounded-sm overflow-hidden">
            {/* < LSL */}
            <div
              className="absolute left-0 top-0 h-full bg-blue-500"
              style={{ width: `${lslBoundaryPos}%` }}
            />
            {/* LSL..USL */}
            <div
              className="absolute top-0 h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-amber-500"
              style={{ left: `${lslBoundaryPos}%`, width: `${inTolSpan}%` }}
            />
            {/* > USL */}
            <div
              className="absolute right-0 top-0 h-full bg-rose-500"
              style={{ width: `${100 - uslBoundaryPos}%` }}
            />

            {/* Hard boundaries + nominal */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[2px] h-5 bg-blue-400 z-10"
              style={{ left: `${lslBoundaryPos}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-[2px] h-5 bg-rose-400 z-10"
              style={{ left: `${uslBoundaryPos}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-slate-400/50 border-dashed z-10"
              style={{ left: `${nominalPos}%` }}
            />

            {/* Actual indicator: vertical white line */}
            <div
              className="absolute top-0 w-[2px] h-full bg-white z-20 shadow-[0_0_4px_#fff]"
              style={{ left: `${clampedPos}%` }}
            />
          </div>
        </div>

        {/* Boundary labels below cutter lines */}
        <div className="relative mt-1 h-4 text-[10px] font-mono tracking-wider">
          <span
            className="absolute -translate-x-1/2 text-blue-400/70 font-semibold"
            style={{ left: `${lslBoundaryPos}%` }}
          >
            LSL {lsl.toFixed(3)}
          </span>
          <span
            className="absolute -translate-x-1/2 text-rose-400/70 font-semibold"
            style={{ left: `${uslBoundaryPos}%` }}
          >
            USL {usl.toFixed(3)}
          </span>
        </div>

        {/* Continuous dashed guide line from track to value label */}
        <div
          className="pointer-events-none absolute top-[4.75rem] bottom-6 -translate-x-1/2"
          style={{ left: `${clampedPos}%` }}
        >
          <div className="h-full border-l border-dashed border-white/45" />
        </div>

        {/* Actual value label below */}
        <div
          className="relative pt-3"
          style={{ paddingLeft: `${clampedPos}%` }}
        >
          <div className="flex -translate-x-1/2 flex-col items-center">
            <span className="mt-0.5 rounded-sm bg-slate-800 px-1.5 py-0.5 text-xs font-bold text-white font-mono">
              {actual.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  highlight,
  status,
}: {
  label: string
  value: string
  unit: string
  highlight?: boolean
  status?: "pass" | "warning" | "high" | "low"
}) {
  // pass = emerald (center), warning = amber (near limits), high = rose (>USL), low = blue (<LSL)
  const statusColors = {
    pass: { icon: "text-emerald-300", value: "text-emerald-300" },
    warning: { icon: "text-amber-300", value: "text-amber-300" },
    high: { icon: "text-rose-300", value: "text-rose-300" },
    low: { icon: "text-blue-500", value: "text-blue-500" },
  }

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        highlight && status === "pass" && "border-emerald-400/35 bg-emerald-500/8",
        highlight && status === "warning" && "border-amber-400/35 bg-amber-500/8",
        highlight && status === "high" && "border-rose-400/35 bg-rose-500/8",
        highlight && status === "low" && "border-blue-500/30 bg-blue-500/8",
        !highlight && "border-border bg-secondary/50"
      )}
    >
      <p className="text-xs text-muted-foreground font-mono mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        {status && (
          <span className="mr-0.5">
            {status === "pass" ? (
              <ArrowUp className={cn("inline h-3 w-3", statusColors.pass.icon)} />
            ) : status === "warning" ? (
              <ArrowUp className={cn("inline h-3 w-3", statusColors.warning.icon)} />
            ) : status === "high" ? (
              <ArrowUp className={cn("inline h-3 w-3", statusColors.high.icon)} />
            ) : (
              <ArrowDown className={cn("inline h-3 w-3", statusColors.low.icon)} />
            )}
          </span>
        )}
        <span
          className={cn(
            "text-lg font-bold font-mono",
            status && statusColors[status]?.value,
            !status && "text-foreground"
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="text-xs text-muted-foreground font-mono">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}
