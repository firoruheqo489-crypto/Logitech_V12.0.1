import { FileSpreadsheet, FileText, UserCheck } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { getModuleStats, type Status } from "./report-data"
import { useReportData } from "./report-data-context"
import { MetaHeader } from "./components/meta-header"
import { StatusBadge } from "./components/status-badge"
import { DrillDown } from "./components/drilldown"

const statusLabel: Record<Status, string> = { P: "P · 合格", F: "F · 不合格", N: "N · 未判定" }

export function FinalSampleReportPage() {
  const { data, error } = useReportData()
  const summary = data.modules.map((module) => ({ module, stats: getModuleStats(module) }))

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 md:px-6 md:py-10">
        {error && <div className="glass rounded-xl border border-fail/35 px-4 py-3 text-sm text-fail">报告解析失败：{error}</div>}

        <section aria-labelledby="parser-heading" className="space-y-3">
          <SectionTitle id="parser-heading" icon={<FileSpreadsheet className="size-4" />}>模块一 · 报告解析区</SectionTitle>
          <MetaHeader />
        </section>

        <section aria-labelledby="conclusion-heading" className="space-y-3">
          <SectionTitle id="conclusion-heading" icon={<FileText className="size-4" />}>模块二 · 测试结论区</SectionTitle>
          <div className="glass grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-4">
            {summary.map(({ module }) => (
              <div key={module.key} className="bg-card/70 px-5 py-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{module.name}</p>
                  <StatusBadge status={module.summaryStatus} size="sm" />
                </div>
                <p className={cn("mt-4 font-mono text-2xl font-semibold", module.summaryStatus === "F" ? "text-fail" : module.summaryStatus === "P" ? "text-pass" : "text-untested-foreground")}>{statusLabel[module.summaryStatus]}</p>
                <p className="mt-1 text-xs text-muted-foreground">报告首页解析结论</p>
              </div>
            ))}
          </div>
          <div className="glass flex flex-wrap gap-x-10 gap-y-3 rounded-xl px-5 py-4 text-sm">
            <span className="inline-flex items-center gap-2"><UserCheck className="size-4 text-primary" />测试人员：<b>{data.meta.tester}</b></span>
            <span>审核人员：<b>{data.meta.reviewer}</b></span>
          </div>
        </section>

        <section aria-labelledby="detail-heading" className="space-y-3">
          <SectionTitle id="detail-heading" icon={<FileText className="size-4" />}>模块三 · 测试明细</SectionTitle>
          <div className="glass overflow-hidden rounded-xl">
            <div className="grid grid-cols-[1.2fr_repeat(4,1fr)] gap-px bg-border px-4 py-3 text-xs font-medium text-muted-foreground sm:px-5">
              <span>测试类别</span><span>总项数</span><span>已测</span><span>合格</span><span>不合格</span>
            </div>
            {summary.map(({ module, stats }) => (
              <div key={module.key} className="grid grid-cols-[1.2fr_repeat(4,1fr)] gap-px border-t border-border px-4 py-4 text-sm sm:px-5">
                <span className="font-semibold text-foreground">{module.name}</span><span>{stats.total}</span><span>{stats.executed}</span><span className="text-pass">{stats.pass}</span><span className="text-fail">{stats.fail}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="fail-heading" className="space-y-3">
          <SectionTitle id="fail-heading" icon={<FileText className="size-4" />}>不合格项目明细</SectionTitle>
          <div className="glass overflow-hidden rounded-xl">
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-px bg-border px-4 py-3 text-xs font-medium text-muted-foreground sm:px-5">
              <span>测试类别</span><span>不合格项目</span><span>判定</span>
            </div>
            {data.modules.flatMap((module) => module.items.filter((item) => item.status === "F").map((item) => ({ module, item }))).length > 0 ? (
              data.modules.flatMap((module) => module.items.filter((item) => item.status === "F").map((item) => ({ module, item }))).map(({ module, item }) => (
                <div key={`${module.key}-${item.code}`} className="grid grid-cols-[1fr_2fr_1fr] gap-px border-t border-border px-4 py-4 text-sm sm:px-5">
                  <span className="font-semibold text-foreground">{module.name}</span>
                  <span className="text-foreground/90">{item.code} · {item.name}</span>
                  <span className="font-mono text-fail">F · 不合格</span>
                </div>
              ))
            ) : (
              <div className="border-t border-border px-4 py-5 text-sm text-muted-foreground">当前没有不合格项目</div>
            )}
          </div>
        </section>

        <DrillDown />

        <footer className="glass rounded-xl px-6 py-4 text-center font-mono text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-pass shadow-[0_0_6px_var(--pass)]" /> P 通过</span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-fail shadow-[0_0_6px_var(--fail)]" /> F 不通过</span>
          <span className="mx-2 text-border">·</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-amber-300/80" /> N 未测试</span>
          <span className="mx-2 text-border">·</span>
          当前仅解析终样测试报告主体矩阵，附件页不参与解析。
        </footer>
      </div>
    </main>
  )
}

function SectionTitle({ id, icon, children }: { id: string; icon: ReactNode; children: ReactNode }) {
  return <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><h2 id={id} className="font-mono text-sm font-semibold tracking-wider text-foreground">{children}</h2></div>
}
