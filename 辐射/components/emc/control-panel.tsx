"use client"

import { cn } from "@/lib/utils"
import { CHANNELS, type ChannelId, type Detector } from "@/lib/emc"
import { CHANNEL_HEX } from "./spectrum-chart"

interface Props {
  enabled: Record<ChannelId, boolean>
  onToggle: (id: ChannelId) => void
  detector: Detector
  onDetector: (d: Detector) => void
  available: Record<ChannelId, boolean>
}

export function ControlPanel({ enabled, onToggle, detector, onDetector, available }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">通道叠加</span>
        {CHANNELS.map((ch) => {
          const isOn = enabled[ch.id] && available[ch.id]
          const color = CHANNEL_HEX[ch.id]
          return (
            <button
              key={ch.id}
              type="button"
              disabled={!available[ch.id]}
              onClick={() => onToggle(ch.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isOn ? "border-transparent text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={isOn ? { background: `${color}22`, borderColor: color } : undefined}
            >
              <span
                className={cn("relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors")}
                style={{ background: isOn ? color : "oklch(0.3 0.01 240)" }}
                aria-hidden
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full bg-background transition-transform",
                    isOn ? "translate-x-3" : "translate-x-0.5",
                  )}
                />
              </span>
              {ch.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">检波器</span>
        <div className="inline-flex overflow-hidden rounded-md border border-input">
          {(["QP", "AV"] as Detector[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDetector(d)}
              className={cn(
                "px-3 py-1.5 text-xs transition-colors",
                detector === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {d === "QP" ? "QP 准峰值" : "AV 平均值"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
