import { MetaHeader } from "@/components/report/meta-header"
import { SummaryKpis } from "@/components/report/summary-kpis"
import { RiskPanel } from "@/components/report/risk-panel"
import { DrillDown } from "@/components/report/drilldown"
import { AppendixData } from "@/components/report/appendix-data"

export default function Page() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6 md:py-10">
        <MetaHeader />
        <SummaryKpis />
        <RiskPanel />
        <DrillDown />
        <AppendixData />

        <footer className="glass rounded-xl px-6 py-4 text-center font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-pass shadow-[0_0_6px_var(--pass)]" /> P PASS
          </span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-fail shadow-[0_0_6px_var(--fail)]" /> F FAIL
          </span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-untested shadow-[0_0_6px_var(--untested)]" /> N NULL
          </span>
          <span className="mx-2 text-border">·</span>
          数据来源 A1 版本终样测试报告，仅用于工程闭环质检分析。
        </footer>
      </div>
    </main>
  )
}
