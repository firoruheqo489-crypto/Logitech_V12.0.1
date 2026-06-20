"use client"

import { cn } from "@/lib/utils"

const MODULES = [
  { id: "1samp", label: "1-Sample T" },
  { id: "2samp", label: "2-Sample T" },
  { id: "anova", label: "ANOVA" },
  { id: "chi", label: "Chi-Square" },
] as const

export function ModuleSelector({
  active,
  onChange,
}: {
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="recessed flex flex-wrap items-center gap-1.5 rounded-lg p-1.5">
      {MODULES.map((m) => {
        const isActive = m.id === active
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={cn(
              "font-num rounded-md px-3.5 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200",
              isActive
                ? "glow-cyan bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
