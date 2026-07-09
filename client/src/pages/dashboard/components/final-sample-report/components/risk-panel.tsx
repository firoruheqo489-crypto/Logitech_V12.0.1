import { AlertTriangle, ShieldOff, Snowflake, Unplug } from "lucide-react"
import { getRiskCards } from "../report-data"
import { useReportData } from "../report-data-context"

const icons = [Unplug, Snowflake, ShieldOff] as const

export function RiskPanel() {
  const {
    data: { modules },
  } = useReportData()
  const risks = getRiskCards(modules)

  return (
    <section aria-labelledby="risk-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-fail" aria-hidden />
        <h2 id="risk-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Risk Containment · 核心风险敞口
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {risks.map(({ level, title, body, tags }, index) => {
          const Icon = icons[index % icons.length]
          return (
            <div
              key={title}
              className="glass overflow-hidden rounded-xl border-fail/35 shadow-[0_0_32px_-12px_var(--fail)] transition-all duration-300 hover:shadow-[0_0_40px_-10px_var(--fail)]"
            >
              <div className="flex items-center gap-2 border-b border-fail/25 bg-fail/[0.06] px-4 py-2.5">
                <span
                  className="size-2 rounded-full bg-fail shadow-[0_0_10px_var(--fail)]"
                  style={{ animation: "status-pulse 1.6s ease-in-out infinite" }}
                  aria-hidden
                />
                <Icon className="size-4 text-fail" aria-hidden />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-fail">
                  {level}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-fail/25 bg-fail/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-fail"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
