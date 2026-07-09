import { MetaHeader } from "./components/meta-header"
import { SummaryKpis } from "./components/summary-kpis"
import { RiskPanel } from "./components/risk-panel"
import { DrillDown } from "./components/drilldown"
import { AppendixData } from "./components/appendix-data"
import { useReportData } from "./report-data-context"

export function FinalSampleReportPage() {
  const { error } = useReportData()

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-6 md:py-10">
        {error && (
          <div className="glass rounded-xl border-fail/35 px-4 py-3 text-sm text-fail">
            真实终样报告加载失败：{error}
          </div>
        )}
        <MetaHeader />
        <SummaryKpis />
        <RiskPanel />
        <DrillDown />
        <AppendixData />

        <footer className="glass rounded-xl px-6 py-4 text-center font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-pass shadow-[0_0_6px_var(--pass)]" /> P 通过
          </span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-fail shadow-[0_0_6px_var(--fail)]" /> F 不通过
          </span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-amber-300/80 shadow-[0_0_6px_rgba(252,211,77,0.28)]" /> N 未测试
          </span>
          <span className="mx-2 text-border">·</span>
          数据来源 A1 版本终样测试报告，页面直接解析真实 Excel 文件并映射到当前看板。
        </footer>
      </div>
    </main>
  )
}
