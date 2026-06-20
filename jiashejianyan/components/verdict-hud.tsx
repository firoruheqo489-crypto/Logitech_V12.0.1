"use client"

import { cn } from "@/lib/utils"
import { AlertTriangle, ShieldCheck } from "lucide-react"

export function VerdictHud({
  pValue,
  alpha,
  reject,
}: {
  pValue: number
  alpha: number
  reject: boolean
}) {
  const pDisplay = pValue < 0.0001 ? "< 0.0001" : pValue.toFixed(4)

  return (
    <section
      className={cn(
        "mech-frame relative overflow-hidden rounded-2xl p-5 text-center transition-colors duration-500 glass",
      )}
      style={
        {
          "--bracket": reject
            ? "oklch(0.7 0.24 25 / 0.8)"
            : "oklch(0.82 0.14 200 / 0.8)",
          boxShadow: reject
            ? "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.7 0.24 25 / 0.4), 0 0 30px oklch(0.7 0.24 25 / 0.18), 0 0 80px -10px oklch(0.7 0.24 25 / 0.55)"
            : "inset 0 1px 0 oklch(0.7 0.02 240 / 0.16), 0 0 0 1px oklch(0.82 0.14 200 / 0.35), 0 0 30px oklch(0.82 0.14 200 / 0.05), 0 0 80px -12px oklch(0.82 0.14 200 / 0.45)",
        } as React.CSSProperties
      }
    >
      {/* inner corner brackets (second pair) */}
      <span className="mech-corners pointer-events-none absolute inset-0" />
      <div className="flex items-center justify-center gap-2">
        <span
          className={cn(
            "font-num text-[10px] uppercase tracking-[0.3em]",
            reject ? "text-[var(--warning)]" : "text-primary",
          )}
        >
          P-Value / P值
        </span>
      </div>

      <div
        className={cn(
          "font-num mt-1 text-5xl font-bold tabular-nums sm:text-6xl",
          reject
            ? "text-[var(--warning)] text-nixie-warning"
            : "text-primary text-nixie-cyan",
        )}
      >
        {pDisplay}
      </div>

      <div
        className={cn(
          "mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
          reject
            ? "animate-pulse bg-[var(--warning)]/15 text-[var(--warning)]"
            : "bg-primary/15 text-primary",
        )}
      >
        {reject ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        {reject ? "REJECT H0 · 拒绝原假设" : "FAIL TO REJECT · 无法拒绝"}
      </div>

      <p className="font-num mt-2 text-[11px] text-muted-foreground">
        {reject ? `P < α (${alpha.toFixed(2)})` : `P ≥ α (${alpha.toFixed(2)})`}
      </p>

      {/* Method declaration — audit trail */}
      <div className="mt-4 flex items-center justify-center gap-2 border-t border-border/40 pt-3">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <p className="font-num text-[10px] tracking-wide text-muted-foreground/80">
          SYS_LOG: Welch&apos;s T-Test Executed (Unequal Variances Assumed)
        </p>
      </div>
    </section>
  )
}
