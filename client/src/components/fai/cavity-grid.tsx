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
}

// Color mapping for the 3 states: OK=green, +NG=red (>USL), -NG=deep blue (<LSL)
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

export function CavityGrid({ cavities, usl, lsl }: CavityGridProps) {
  const okCount = cavities.filter((c) => c.status === "OK").length
  const plusNgCount = cavities.filter((c) => c.status === "+NG").length
  const minusNgCount = cavities.filter((c) => c.status === "-NG").length
  const range = usl - lsl

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase font-mono">
          CAVITY TEST MATRIX
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground font-mono">
              OK: {okCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground font-mono">
              +NG: {plusNgCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-600" />
            <span className="text-xs text-muted-foreground font-mono">
              -NG: {minusNgCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            YIELD: {((okCount / cavities.length) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
        {cavities.map((cavity) => {
          const cfg = statusConfig[cavity.status]
          const deviationPercent = Math.abs(
            ((cavity.value - (usl + lsl) / 2) / (range / 2)) * 100
          )
          return (
            <div
              key={cavity.id}
              className={cn(
                "group relative rounded-md border px-2.5 py-2 transition-all hover:scale-[1.02]",
                cfg.border,
                cfg.bg,
                cavity.status === "OK" && "hover:border-green-500/40",
                cavity.status === "+NG" && "hover:border-red-500/50",
                cavity.status === "-NG" && "hover:border-blue-600/50"
              )}
            >
              {/* Cavity Label */}
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-muted-foreground">
                  {cavity.label}
                </span>
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

              {/* Value */}
              <p className={cn("text-sm font-bold font-mono", cfg.text)}>
                {cavity.value.toFixed(3)}
              </p>

              {/* Mini deviation bar */}
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all", cfg.barBg)}
                  style={{
                    width: `${Math.min(100, deviationPercent)}%`,
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
