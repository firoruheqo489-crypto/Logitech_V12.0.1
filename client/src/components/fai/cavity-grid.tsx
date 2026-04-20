"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type CavityStatus = "OK" | "+NG" | "-NG"

interface CavityData {
  id: string
  label: string
  value: number
  status: CavityStatus
}

interface CavityGridProps {
  cavities: CavityData[]
  usl: number
  lsl: number
  faiLabel?: string
  sampleValues?: number[]
}

const statusConfig: Record<
  CavityStatus,
  { border: string; bg: string; text: string; badgeBg: string; badgeText: string; barBg: string }
> = {
  OK: {
    border: "border-green-500/25",
    bg: "bg-green-500/5",
    text: "text-foreground",
    badgeBg: "bg-green-500/20",
    badgeText: "text-green-500",
    barBg: "bg-green-500/50",
  },
  "+NG": {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    text: "text-red-400",
    badgeBg: "bg-red-500/20",
    badgeText: "text-red-400",
    barBg: "bg-red-500/50",
  },
  "-NG": {
    border: "border-blue-600/35",
    bg: "bg-blue-600/8",
    text: "text-blue-500",
    badgeBg: "bg-blue-600/25",
    badgeText: "text-blue-500",
    barBg: "bg-blue-600/60",
  },
}

const weakOkConfig = {
  border: "border-amber-400/35",
  bg: "bg-amber-500/8",
  text: "text-foreground",
  badgeBg: "bg-amber-400/20",
  badgeText: "text-amber-300",
  barBg: "bg-amber-400/70",
}

export function CavityGrid({ cavities, usl, lsl, faiLabel, sampleValues }: CavityGridProps) {
  const okCount = cavities.filter((c) => c.status === "OK").length
  const plusNgCount = cavities.filter((c) => c.status === "+NG").length
  const minusNgCount = cavities.filter((c) => c.status === "-NG").length

  const valuesForYellow =
    sampleValues && sampleValues.length > 0
      ? sampleValues
      : cavities.map((c) => c.value)

  const toleranceWidth = usl - lsl
  const yellowLowerBound = lsl + toleranceWidth * 0.2
  const yellowUpperBound = usl - toleranceWidth * 0.2
  const isYellowByTolerance = (value: number) => {
    if (toleranceWidth <= 0) {
      return false
    }

    return (
      (value >= lsl && value <= yellowLowerBound) ||
      (value >= yellowUpperBound && value <= usl)
    )
  }
  const yellowCount =
    toleranceWidth > 0 ? valuesForYellow.filter((value) => isYellowByTolerance(value)).length : 0
  const yellowRate = valuesForYellow.length > 0 ? ((yellowCount / valuesForYellow.length) * 100).toFixed(1) : "0.0"

  const safeRange = toleranceWidth === 0 ? 0.000001 : toleranceWidth
  const centerValue = (usl + lsl) / 2
  const halfRange = safeRange / 2
  const getScorePercent = (value: number) => {
    const normalizedDeviation = Math.abs(value - centerValue) / halfRange
    const score = Math.max(0, 1 - normalizedDeviation)
    return score * 100
  }

  const yieldRate = cavities.length > 0 ? ((okCount / cavities.length) * 100).toFixed(1) : "0.0"
  const normalizedFaiLabel = (faiLabel ?? "").trim()
  const isFaiPrefixedLabel = normalizedFaiLabel.toUpperCase().startsWith("FAI")
  const faiSuffix = isFaiPrefixedLabel ? normalizedFaiLabel.slice(3) : normalizedFaiLabel

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase font-mono">
          CAVITY TEST MATRIX{" "}
          {normalizedFaiLabel ? (
            <>
              ·{" "}
              <span className="inline-flex items-center rounded-sm border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5">
                <span className="text-slate-200">FAI</span>
                <span className="text-amber-300">{faiSuffix}</span>
              </span>
            </>
          ) : null}
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground font-mono">OK: {okCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground font-mono">+NG: {plusNgCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs text-muted-foreground font-mono">-NG: {minusNgCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs text-muted-foreground font-mono">
              边缘黄区: {yellowCount} ({yellowRate}%)
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">YIELD: {yieldRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
        {cavities.map((cavity) => {
          const scorePercent = getScorePercent(cavity.value)
          const isYellowWarning = cavity.status === "OK" && isYellowByTolerance(cavity.value)
          const cfg = isYellowWarning ? weakOkConfig : statusConfig[cavity.status]
          return (
            <div
              key={cavity.id}
              className={cn(
                "group relative rounded-md border px-2.5 py-2 transition-all hover:scale-[1.02]",
                cfg.border,
                cfg.bg,
                isYellowWarning && "hover:border-amber-400/55",
                cavity.status === "OK" && !isYellowWarning && "hover:border-green-500/40",
                cavity.status === "+NG" && "hover:border-red-500/50",
                cavity.status === "-NG" && "hover:border-blue-600/50"
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-muted-foreground">{cavity.label}</span>
                <Badge
                  className={cn(
                    "h-4 px-1.5 text-[10px] font-bold font-mono border-0",
                    cfg.badgeBg,
                    cfg.badgeText
                  )}
                >
                  {cavity.status}
                </Badge>
              </div>

              <p className={cn("text-sm font-bold font-mono", cfg.text)}>{cavity.value.toFixed(3)}</p>

              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all", cfg.barBg)}
                  style={{
                    width: `${Math.max(0, Math.min(100, scorePercent))}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
