import { CheckCircle2, ShieldAlert, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Status } from "@/lib/report-data"

const config: Record<
  Status,
  { label: string; className: string; dot: string; glow: string; Icon: typeof CheckCircle2 }
> = {
  P: {
    label: "PASS",
    className: "bg-pass/10 text-pass border-pass/40",
    dot: "bg-pass",
    glow: "shadow-[0_0_10px_var(--pass)]",
    Icon: CheckCircle2,
  },
  F: {
    label: "FAIL",
    className: "bg-fail/12 text-fail border-fail/45",
    dot: "bg-fail",
    glow: "shadow-[0_0_12px_var(--fail)]",
    Icon: ShieldAlert,
  },
  N: {
    label: "NULL",
    className: "bg-untested/10 text-untested-foreground border-untested/30",
    dot: "bg-untested",
    glow: "shadow-[0_0_8px_var(--untested)]",
    Icon: HelpCircle,
  },
}

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: Status
  size?: "sm" | "md"
  className?: string
}) {
  const { label, className: c, dot, glow, Icon } = config[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-mono font-semibold uppercase leading-none tracking-wider",
        size === "sm" ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-xs",
        c,
        className,
      )}
    >
      <span className="relative flex items-center">
        <span
          className={cn(
            "inline-block rounded-full",
            size === "sm" ? "size-1.5" : "size-2",
            dot,
            glow,
          )}
          style={{ animation: "status-pulse 1.8s ease-in-out infinite" }}
          aria-hidden
        />
      </span>
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      {label}
    </span>
  )
}

export function StatusDot({ status }: { status: Status }) {
  const map = {
    P: "bg-pass shadow-[0_0_10px_var(--pass)]",
    F: "bg-fail shadow-[0_0_12px_var(--fail)]",
    N: "bg-untested shadow-[0_0_8px_var(--untested)]",
  }
  return (
    <span
      className={cn("inline-block size-2 rounded-full", map[status])}
      style={{ animation: "status-pulse 1.8s ease-in-out infinite" }}
      aria-hidden
    />
  )
}
