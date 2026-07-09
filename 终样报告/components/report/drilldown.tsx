"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, FileSearch, Filter, ExternalLink, Terminal } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"
import {
  modules,
  getModuleStats,
  type ReportModule,
  type Status,
  type TestItem,
} from "@/lib/report-data"

type FilterKey = "all" | Status | "risk"

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "P", label: "合格" },
  { key: "F", label: "不合格" },
  { key: "N", label: "未测" },
  { key: "risk", label: "风险" },
]

function ItemRow({ item }: { item: TestItem }) {
  const accent =
    item.status === "P" ? "before:bg-pass" : item.status === "F" ? "before:bg-fail" : "before:bg-untested"
  return (
    <div
      className={cn(
        "relative grid grid-cols-1 gap-3 px-4 py-3 transition-all duration-300 sm:grid-cols-[auto_1fr_auto] sm:items-center",
        "before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full",
        accent,
        "hover:bg-slate-500/10",
        item.risk && "bg-fail/[0.06]",
      )}
    >
      <div className="flex items-center gap-2 sm:w-16">
        <span className="font-mono text-xs font-semibold text-primary/90">{item.code}</span>
        {item.risk && <AlertTriangle className="size-3.5 text-fail" aria-hidden />}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          {item.result && (
            <span className="inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary/90">
              <ExternalLink className="size-2.5" aria-hidden />
              {item.result}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 font-mono text-xs leading-relaxed text-muted-foreground" title={item.standard}>
          {item.standard}
        </p>
        {item.note && (
          <p className={cn("mt-1 text-xs font-medium", item.risk ? "text-fail" : "text-untested-foreground")}>
            ⚑ {item.note}
          </p>
        )}
      </div>

      <div className="sm:justify-self-end">
        <StatusBadge status={item.status} size="sm" />
      </div>
    </div>
  )
}

function ModulePanel({ mod }: { mod: ReportModule }) {
  const [filter, setFilter] = useState<FilterKey>("all")
  const stats = getModuleStats(mod)

  const shown = useMemo(() => {
    return mod.items.filter((i) => {
      if (filter === "all") return true
      if (filter === "risk") return Boolean(i.risk)
      return i.status === filter
    })
  }, [mod.items, filter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{mod.fullName}</span>
          <span className="mx-2 text-border">|</span>
          依据标准：<span className="font-mono text-foreground/90">{mod.standard}</span>
          <span
            className={cn(
              "ml-2 rounded px-1.5 py-0.5 font-mono text-[10px]",
              mod.standardType === "rigid"
                ? "border border-primary/25 bg-primary/10 text-primary"
                : "border border-untested/25 bg-untested/10 text-untested-foreground",
            )}
          >
            {mod.standardType === "rigid" ? "刚性 · 行业强制" : "柔性 · 企业共识"}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-0.5 backdrop-blur">
          <Filter className="ml-1.5 size-3 text-muted-foreground" aria-hidden />
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-xs font-medium transition-all duration-200",
                filter === f.key
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_-2px_var(--primary)]"
                  : "text-muted-foreground hover:bg-slate-500/15 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {mod.standardType === "soft" && (
        <div className="flex items-start gap-2 rounded-lg border border-untested/30 bg-untested/[0.06] px-3 py-2 text-xs text-untested-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            逻辑质检提醒：本模块统一指向「依据规格书要求」。若规格书无唯一版本受控编号，此模糊表述将成为品质与研发定责的漏洞。
          </span>
        </div>
      )}

      <div className="glass divide-y divide-border overflow-hidden rounded-xl">
        {shown.length > 0 ? (
          shown.map((item) => <ItemRow key={item.code} item={item} />)
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted-foreground">
            <FileSearch className="size-6" aria-hidden />
            <p className="text-sm">当前筛选条件下无匹配的测试项</p>
          </div>
        )}
      </div>

      <p className="text-right font-mono text-xs text-muted-foreground">
        显示 {shown.length} / {stats.total} 项 · 已测 {stats.executed} · 未测 {stats.untested}
      </p>
    </div>
  )
}

export function DrillDown() {
  return (
    <section aria-labelledby="drill-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="size-4 text-primary" aria-hidden />
        <h2 id="drill-heading" className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
          Telemetry Detail Grid · 明细下钻区
        </h2>
      </div>

      <Tabs defaultValue={modules[0].key}>
        <TabsList className="w-full justify-start overflow-x-auto border border-border bg-secondary/40 backdrop-blur">
          {modules.map((mod) => (
            <TabsTrigger key={mod.key} value={mod.key} className="gap-1.5 font-mono data-[state=active]:shadow-[0_0_12px_-4px_var(--primary)]">
              {mod.name}
              <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                {mod.items.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {modules.map((mod) => (
          <TabsContent key={mod.key} value={mod.key} className="mt-4">
            <ModulePanel mod={mod} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
