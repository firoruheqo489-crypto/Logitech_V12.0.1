import { ShieldCheck, Radio, Gauge, Timer, TrendingUp, Layers, AlertTriangle, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"
import { getModuleStats, getOverallStats, type ReportModule } from "../report-data"
import { useReportData } from "../report-data-context"

const moduleIcons = {
  S: ShieldCheck,
  E: Radio,
  P: Gauge,
  R: Timer,
} as const

function aggregateRisk(mod: ReportModule): {
  label: string
  tone: "critical" | "void" | "clear"
} {
  const stats = getModuleStats(mod)
  if (mod.summaryStatus === "F" || stats.fail > 0) return { label: "CRITICAL RISK", tone: "critical" }
  if (stats.total > 0 && stats.untested / stats.total >= 0.5) return { label: "VERIFICATION VOID", tone: "void" }
  return { label: "CONTAINED", tone: "clear" }
}

const toneStyles = {
  critical: {
    ring: "border-fail/45 shadow-[0_0_28px_-8px_var(--fail)]",
    icon: "bg-fail/10 text-fail ring-fail/40",
    label: "text-fail",
    bar: "bg-fail",
  },
  void: {
    ring: "border-untested/40 shadow-[0_0_24px_-10px_var(--untested)]",
    icon: "bg-untested/10 text-untested-foreground ring-untested/40",
    label: "text-untested-foreground",
    bar: "bg-untested",
  },
  clear: {
    ring: "border-pass/45 shadow-[0_0_28px_-8px_var(--pass)]",
    icon: "bg-pass/10 text-pass ring-pass/40",
    label: "text-pass",
    bar: "bg-pass",
  },
} as const

function ModuleCard({ mod }: { mod: ReportModule }) {
  const stats = getModuleStats(mod)
  const Icon = moduleIcons[mod.key]
  const risk = aggregateRisk(mod)
  const t = toneStyles[risk.tone]
  return (
    <div className={cn("glass rounded-xl p-4 transition-all duration-300", t.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex size-10 items-center justify-center rounded-lg ring-1", t.icon)}>
            <Icon className="size-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {mod.name}
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">/ {mod.key}</span>
            </p>
            <p className="text-xs text-muted-foreground">{mod.items.length} 项明细</p>
          </div>
        </div>
        <StatusBadge status={mod.summaryStatus} size="sm" />
      </div>

      <div className={cn("mt-3 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider", t.label)}>
        <AlertTriangle className="size-3.5" aria-hidden />
        {risk.label}
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">已测覆盖率</span>
          <span className="font-mono font-medium text-foreground">{stats.coverage}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${stats.coverage}%` }} />
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-pass shadow-[0_0_6px_var(--pass)]" />
            {stats.pass}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-fail shadow-[0_0_6px_var(--fail)]" />
            {stats.fail}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-untested shadow-[0_0_6px_var(--untested)]" />
            {stats.untested}
          </span>
          <span className="ml-auto truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {mod.standardType === "rigid" ? "刚性标准" : "柔性标准"}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  hint,
  tone = "default",
}: {
  icon: typeof TrendingUp
  label: string
  value: string | number
  suffix?: string
  hint: string
  tone?: "default" | "fail" | "warn"
}) {
  const toneClass =
    tone === "fail" ? "text-fail" : tone === "warn" ? "text-untested-foreground" : "text-primary"
  const glow =
    tone === "fail"
      ? "shadow-[0_0_28px_-12px_var(--fail)]"
      : tone === "warn"
        ? "shadow-[0_0_28px_-12px_var(--untested)]"
        : "shadow-[0_0_28px_-12px_var(--primary)]"
  return (
    <div className={cn("glass flex flex-col justify-between rounded-xl p-4", glow)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", toneClass)} aria-hidden />
      </div>
      <div className="mt-3">
        <p className={cn("font-mono text-3xl font-semibold leading-none", toneClass)}>
          {value}
          {suffix && <span className="ml-0.5 text-lg text-muted-foreground">{suffix}</span>}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

export function SummaryKpis() {
  const {
    data: { modules },
  } = useReportData()
  const overall = getOverallStats(modules)

  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-primary" aria-hidden />
        <h2 id="summary-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          System Risk Matrix · 聚合统筹盘
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="模块通过率"
          value={overall.modulePassRate}
          suffix="%"
          hint={`${overall.modulePass} / ${overall.moduleTotal} 模块判定通过`}
          tone="fail"
        />
        <StatCard
          icon={Layers}
          label="明细已测覆盖率"
          value={overall.coverage}
          suffix="%"
          hint={`${overall.executed} / ${overall.total} 项产生数据或判定`}
          tone="warn"
        />
        <StatCard
          icon={HelpCircle}
          label="未测项 (N)"
          value={overall.untested}
          hint={`占全部 ${overall.total} 项的 ${overall.total > 0 ? Math.round((overall.untested / overall.total) * 100) : 0}%`}
        />
        <StatCard
          icon={AlertTriangle}
          label="系统级风险源"
          value={overall.riskCount}
          hint="需要在看板中标红高亮的闭环缺口"
          tone="fail"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modules.map((mod) => (
          <ModuleCard key={mod.key} mod={mod} />
        ))}
      </div>
    </section>
  )
}
