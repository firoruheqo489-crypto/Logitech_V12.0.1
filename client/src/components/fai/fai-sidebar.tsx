"use client"

import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Crosshair, ChevronRight } from "lucide-react"

// Cavity data for aggregated status calculation
interface CavityData {
  value: number
  status: "OK" | "+NG" | "-NG"
}

interface FAIItem {
  id: string
  label: string
  cavities: number
  // Aggregated status computed from cavity data
  aggregatedStatus: "pass" | "fail-high" | "fail-low" | "no-data"
}

interface FAISidebarProps {
  items: FAIItem[]
  selectedId: string
  onSelect: (id: string) => void
}

// Utility to compute aggregated status from cavities
export function computeAggregatedStatus(
  cavities: CavityData[]
): "pass" | "fail-high" | "fail-low" | "no-data" {
  if (!cavities || cavities.length === 0) return "no-data"
  
  const hasHighNG = cavities.some((c) => c.status === "+NG")
  const hasLowNG = cavities.some((c) => c.status === "-NG")
  
  // Priority: red (>USL) takes precedence over blue (<LSL)
  if (hasHighNG) return "fail-high"
  if (hasLowNG) return "fail-low"
  return "pass"
}

export function FAISidebar({ items, selectedId, onSelect }: FAISidebarProps) {
  return (
    <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-[#0f172a] overflow-y-auto">
      <div className="flex h-full min-h-screen flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Crosshair className="h-5 w-5 text-slate-300" />
          <div>
            <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
              FAI INDEX
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {items.length} DIMENSIONS
            </p>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-2">
            {items.map((item) => {
              const isSelected = item.id === selectedId
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left transition-all",
                    isSelected
                      ? "bg-slate-800 border border-slate-700"
                      : "border border-transparent hover:bg-slate-900 hover:border-slate-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Status Indicator - aggregated from cavity data */}
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        item.aggregatedStatus === "pass" && "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
                        item.aggregatedStatus === "fail-high" && "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]",
                        item.aggregatedStatus === "fail-low" && "bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]",
                        item.aggregatedStatus === "no-data" && "bg-slate-700"
                      )}
                    />
                    <div>
                      <p
                        className={cn(
                          "text-sm font-mono font-semibold",
                          isSelected ? "text-slate-100" : "text-slate-400"
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {item.cavities} POINTS
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-all",
                      isSelected
                        ? "text-slate-200 opacity-100"
                        : "text-slate-500 opacity-0 group-hover:opacity-100"
                    )}
                  />
                </button>
              )
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-slate-800 px-4 py-2.5">
          <p className="text-xs text-slate-500 font-mono">
            LAST UPDATED: 2026-04-18 09:32
          </p>
        </div>
      </div>
    </div>
  )
}
