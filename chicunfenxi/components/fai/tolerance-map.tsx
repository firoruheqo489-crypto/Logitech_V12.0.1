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
  // Position as percentage within the tolerance band
  const posPercent = ((actual - lsl) / toleranceRange) * 100
  const clampedPos = Math.max(2, Math.min(98, posPercent))
  const nominalPos = ((nominal - lsl) / toleranceRange) * 100

  const isInTolerance = actual >= lsl && actual <= usl

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
            isInTolerance
              ? "bg-green-500/15 text-green-500"
              : actual > usl
                ? "bg-red-500/15 text-red-500"
                : "bg-blue-600/15 text-blue-600"
          )}
        >
          {isInTolerance ? "IN TOL" : "OUT OF TOL"}
        </span>
      </div>

      {/* Metrics Row: 6 cards - 标准值, 上限值, 下限值, 实测均值, σ, Range */}
      <div className="mb-5 grid grid-cols-6 gap-2">
        <MetricCard label="标准值 / NOM" value={nominal.toFixed(3)} unit={unit} />
        <MetricCard label="上限值 / USL" value={usl.toFixed(3)} unit={unit} />
        <MetricCard label="下限值 / LSL" value={lsl.toFixed(3)} unit={unit} />
        <MetricCard 
          label="实测均值 / X̄" 
          value={actual.toFixed(4)} 
          unit={unit} 
          highlight 
          status={actual > usl ? "high" : actual < lsl ? "low" : "pass"}
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
        {/* Labels */}
        <div className="mb-2 flex items-center justify-between text-xs font-mono">
          <span className="text-blue-600 font-bold">LSL {lsl.toFixed(3)}</span>
          <span className="text-muted-foreground">NOMINAL {nominal.toFixed(3)}</span>
          <span className="text-red-500 font-bold">USL {usl.toFixed(3)}</span>
        </div>

        {/* Bar Container */}
        <div className="relative h-10 rounded-md overflow-hidden">
          {/* Background gradient zones */}
          <div className="absolute inset-0 flex">
            <div className="w-[15%] bg-blue-600/40" />
            <div className="w-[20%] bg-amber-600/25" />
            <div className="flex-1 bg-slate-700/50" />
            <div className="w-[20%] bg-amber-600/25" />
            <div className="w-[15%] bg-red-500/35" />
          </div>

          {/* Grid lines */}
          <div className="absolute inset-0">
            {[15, 35, 50, 65, 85].map((p) => (
              <div
                key={p}
                className="absolute top-0 bottom-0 w-px bg-border/50"
                style={{ left: `${p}%` }}
              />
            ))}
          </div>

          {/* Nominal line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50"
            style={{ left: `${nominalPos}%` }}
          />

          {/* Actual value indicator */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
            style={{ left: `${clampedPos}%`, transform: "translateX(-50%)" }}
          >
            <div
              className={cn(
                "h-full w-1 rounded-full",
                isInTolerance
                  ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]"
                  : actual > usl
                    ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                    : "bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)]"
              )}
            />
          </div>
        </div>

        {/* Actual value label below */}
        <div
          className="relative mt-1"
          style={{ paddingLeft: `${clampedPos}%` }}
        >
          <div className="flex -translate-x-1/2 flex-col items-center">
            <div className={cn(
              "h-0 w-0 border-x-4 border-b-4 border-x-transparent",
              isInTolerance 
                ? "border-b-green-500" 
                : actual > usl 
                  ? "border-b-red-500" 
                  : "border-b-blue-600"
            )} />
            <span
              className={cn(
                "mt-0.5 rounded px-1.5 py-0.5 text-xs font-bold font-mono",
                isInTolerance
                  ? "bg-green-500/15 text-green-500"
                  : actual > usl
                    ? "bg-red-500/15 text-red-500"
                    : "bg-blue-600/15 text-blue-600"
              )}
            >
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
  status?: "pass" | "high" | "low"
}) {
  // pass = green (OK), high = red (>USL), low = deep blue (<LSL)
  const statusColors = {
    pass: { icon: "text-green-500", value: "text-green-500" },
    high: { icon: "text-red-500", value: "text-red-500" },
    low: { icon: "text-blue-600", value: "text-blue-600" },
  }

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        highlight && status === "pass" && "border-green-500/30 bg-green-500/5",
        highlight && status === "high" && "border-red-500/30 bg-red-500/5",
        highlight && status === "low" && "border-blue-600/30 bg-blue-600/5",
        !highlight && "border-border bg-secondary/50"
      )}
    >
      <p className="text-xs text-muted-foreground font-mono mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        {status && (
          <span className="mr-0.5">
            {status === "pass" ? (
              <ArrowUp className={cn("inline h-3 w-3", statusColors.pass.icon)} />
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
