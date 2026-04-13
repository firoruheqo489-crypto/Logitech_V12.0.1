"use client"

import { useState } from "react"
import {
  FileText,
  BarChart3,
  Stethoscope,
  Wrench,
  ListFilter,
  Plus,
} from "lucide-react"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HealthScoreHeader } from "./health-score-header"
import { ClinicalHistoryTable } from "./clinical-history-table"
import { SummaryStats, ReliabilityImpactBar } from "./summary-stats"
import { RecoveryTrendChart } from "./recovery-trend-chart"
import AddMaintenanceRecordSheet from "./add-maintenance-record-sheet"
import { EVENT_TYPE_CONFIG } from "@/lib/mold-health-types"
import type { MoldAssetInfo, MoldHealthEvent, EventType } from "@/lib/mold-health-types"
import { cn } from "@/lib/utils"

type FilterType = "ALL" | EventType

const FILTER_OPTIONS: {
  value: FilterType
  labelZh: string
  labelEn: string
  icon: typeof ListFilter
  color?: string
  activeClassName?: string
  activeTextClassName?: string
}[] = [
  {
    value: "ALL",
    labelZh: "全部",
    labelEn: "ALL",
    icon: ListFilter,
    activeClassName:
      "border-teal-800/50 bg-teal-900/20 text-teal-400 shadow-[0_0_0_1px_rgba(20,184,166,0.08),0_0_18px_rgba(13,148,136,0.08)]",
    activeTextClassName: "text-teal-300",
  },
  {
    value: "SICKNESS",
    labelZh: "纠正性",
    labelEn: "CORRECTIVE",
    icon: Stethoscope,
    color: EVENT_TYPE_CONFIG.SICKNESS.color,
    activeClassName: EVENT_TYPE_CONFIG.SICKNESS.filterActiveClassName,
    activeTextClassName: EVENT_TYPE_CONFIG.SICKNESS.filterActiveTextClassName,
  },
  {
    value: "SURGERY",
    labelZh: "大修",
    labelEn: "MAJOR REPAIR",
    icon: Wrench,
    color: EVENT_TYPE_CONFIG.SURGERY.color,
    activeClassName: EVENT_TYPE_CONFIG.SURGERY.filterActiveClassName,
    activeTextClassName: EVENT_TYPE_CONFIG.SURGERY.filterActiveTextClassName,
  },
]

function BilingualStack({
  zh,
  en,
  className,
}: {
  zh: string
  en: string
  className?: string
}) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="font-bold">{zh}</span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-current/75">
        {en}
      </span>
    </span>
  )
}

export function MoldClinicalScorecard({
  asset,
  events,
  onRecordCreated,
}: {
  asset: MoldAssetInfo
  events: MoldHealthEvent[]
  onRecordCreated?: () => Promise<void> | void
}) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL")
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false)
  const visibleEvents = events.filter((event) => event.type !== "CHECKUP")
  const filteredCount = visibleEvents.filter(
    (event) => activeFilter === "ALL" || event.type === activeFilter
  ).length

  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-800 bg-[#050812]/50 shadow-none backdrop-blur-sm">
      <CardContent className="px-6 pt-6">
        <HealthScoreHeader asset={asset} />
      </CardContent>

      <div className="px-6">
        <Separator className="bg-slate-800/80" />
      </div>

      <CardContent className="px-6 pt-7">
        <SummaryStats events={visibleEvents} />
      </CardContent>

      <div className="px-6">
        <Separator className="bg-slate-800/80" />
      </div>

      <CardContent className="px-6 pt-7">
        <ReliabilityImpactBar events={visibleEvents} />
      </CardContent>

      <div className="px-6">
        <Separator className="bg-slate-800/80" />
      </div>

      <CardContent className="px-6 pt-7">
        <Tabs defaultValue="history" className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-1 flex-col gap-4">
              <div className="inline-flex w-fit">
                <TabsList className="h-auto gap-2 bg-transparent p-0">
                  <TabsTrigger
                    value="history"
                    className="h-11 gap-2 rounded-md border-none bg-transparent px-4 py-0 text-[13px] font-medium tracking-[0.02em] text-slate-500 shadow-none data-[state=active]:border data-[state=active]:border-slate-700/50 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <FileText className="size-[17px]" />
                    <BilingualStack zh="维修履历" en="MAINTENANCE HISTORY" className="items-start text-left" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="trend"
                    className="h-11 gap-2 rounded-md border-none bg-transparent px-4 py-0 text-[13px] font-medium tracking-[0.02em] text-slate-500 shadow-none hover:text-slate-300 data-[state=active]:border data-[state=active]:border-slate-700/50 data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm"
                  >
                    <BarChart3 className="size-[17px]" />
                    <BilingualStack zh="修模趋势图" en="MAINTENANCE TREND" className="items-start text-left" />
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              className="h-14 w-full rounded-2xl border border-cyan-500/24 bg-[linear-gradient(135deg,rgba(34,67,98,0.88),rgba(77,138,180,0.76))] px-6 text-[11px] font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(34,211,238,0.08)] hover:bg-[linear-gradient(135deg,rgba(41,77,112,0.92),rgba(87,152,195,0.8))] lg:w-auto lg:text-[11px]"
              onClick={() => setIsAddRecordOpen(true)}
            >
              <Plus className="mr-2 size-4" />
              <span className="font-bold">提报修模记录</span>
              <span className="ml-2 font-semibold text-slate-100/90">/ Add Record</span>
            </Button>
          </div>

          <TabsContent value="history" className="mt-4">
            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
              <div className="flex flex-col gap-3 border-b border-slate-800/60 px-4 py-3.5 lg:flex-row lg:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  {FILTER_OPTIONS.map((option) => {
                    const isActive = activeFilter === option.value

                    return (
                      <button
                        key={option.value}
                        onClick={() => setActiveFilter(option.value)}
                        className={cn(
                          "flex min-w-[154px] items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                          isActive
                            ? option.activeClassName
                            : "border-transparent bg-transparent text-slate-500 hover:text-slate-300"
                        )}
                      >
                        <option.icon
                          className={cn(
                            "size-5 shrink-0",
                            option.color,
                            isActive && option.activeTextClassName
                          )}
                        />
                        <BilingualStack
                          zh={option.labelZh}
                          en={option.labelEn}
                          className={cn(
                            "items-start text-left",
                            isActive ? option.activeTextClassName : "text-slate-500"
                          )}
                        />
                      </button>
                    )
                  })}
                </div>

                <span className="shrink-0 font-mono text-xs text-slate-500 lg:ml-auto">
                  {filteredCount} 条 / records
                </span>
              </div>

              <ClinicalHistoryTable
                moldId={asset.moldId}
                events={visibleEvents}
                filter={activeFilter}
                onChanged={onRecordCreated}
              />
            </div>
          </TabsContent>

          <TabsContent value="trend" className="mt-4">
            <RecoveryTrendChart events={visibleEvents} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <div className="border-t border-slate-800/60 px-6 py-3">
        <p className="text-[11px] leading-relaxed text-slate-500/70">
          <span>[FRACAS Engine v2.4]</span>
          <span className="ml-2">
            The bathtub curve remains untouched. The current zone is derived from live
            telemetry, and the saved maintenance record refreshes immediately.
          </span>
        </p>
      </div>

      <AddMaintenanceRecordSheet
        open={isAddRecordOpen}
        onOpenChange={setIsAddRecordOpen}
        moldId={asset.moldId}
        moldNo={asset.moldName}
        currentShots={asset.totalShots}
        onCreated={onRecordCreated}
      />
    </Card>
  )
}
