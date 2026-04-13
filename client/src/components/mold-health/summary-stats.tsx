"use client"

import { Stethoscope, Wrench, Clock, TrendingUp } from "lucide-react"
import { EVENT_TYPE_CONFIG } from "@/lib/mold-health-types"
import type { MoldHealthEvent } from "@/lib/mold-health-types"
import { cn } from "@/lib/utils"

export function SummaryStats({ events }: { events: MoldHealthEvent[] }) {
  const correctiveCount = events.filter((event) => event.type === "SICKNESS").length
  const majorRepairCount = events.filter((event) => event.type === "SURGERY").length
  const totalDowntime = events.reduce((total, event) => total + event.downtimeHours, 0)
  const mtbf =
    events.length > 1
      ? Math.round(
          (events[events.length - 1].timestamp.getTime() - events[0].timestamp.getTime()) /
            (1000 * 60 * 60 * 24) /
            (correctiveCount + majorRepairCount || 1)
        )
      : 0

  const stats = [
    {
      labelZh: "纠正性维护",
      labelEn: "CORRECTIVE",
      value: correctiveCount,
      unitZh: "次",
      unitEn: "pcs",
      icon: Stethoscope,
      color: EVENT_TYPE_CONFIG.SICKNESS.statsColor,
      bgColor: EVENT_TYPE_CONFIG.SICKNESS.statsBgColor,
    },
    {
      labelZh: "大修/改造",
      labelEn: "MAJOR REPAIR",
      value: majorRepairCount,
      unitZh: "次",
      unitEn: "pcs",
      icon: Wrench,
      color: EVENT_TYPE_CONFIG.SURGERY.statsColor,
      bgColor: EVENT_TYPE_CONFIG.SURGERY.statsBgColor,
    },
    {
      labelZh: "总停机时间",
      labelEn: "TOTAL DOWNTIME",
      value: totalDowntime,
      unitZh: "h",
      unitEn: "",
      icon: Clock,
      color: "text-sky-400",
      bgColor: "bg-sky-500/16",
    },
    {
      labelZh: "MTBF",
      labelEn: "MEAN TIME BETWEEN FAILURES",
      value: mtbf,
      unitZh: "天",
      unitEn: "days",
      icon: TrendingUp,
      color: "text-violet-400",
      bgColor: "bg-violet-500/16",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.labelZh}
          className="flex min-h-[154px] items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/55 px-5 py-5 text-center"
        >
          <div className="flex items-center gap-5">
            <div className={cn("rounded-[20px] p-3.5", stat.bgColor)}>
              <stat.icon className={cn("size-7", stat.color)} />
            </div>

            <div className="flex flex-col items-start justify-center">
              <div className="flex items-end gap-1.5 leading-none">
                <span className="font-mono text-[36px] font-medium tracking-[-0.03em] text-slate-100 lg:text-[40px]">
                  {stat.value}
                </span>
                <span className="pb-1 text-[15px] text-slate-300">{stat.unitZh}</span>
                {stat.unitEn ? (
                  <span className="pb-1 text-[14px] text-slate-500">/ {stat.unitEn}</span>
                ) : null}
              </div>

              <span className="mt-3 flex flex-col items-start gap-2.5 leading-none text-left">
                <span className="text-[14px] font-medium tracking-[0.04em] text-slate-300">
                  {stat.labelZh}
                </span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {stat.labelEn}
                </span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function ReliabilityImpactBar({ events }: { events: MoldHealthEvent[] }) {
  const avgRecovery =
    events.length > 0
      ? events.reduce((total, event) => total + event.recoveryRating, 0) / events.length
      : 0

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-secondary/15 px-5 py-4">
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-end justify-between gap-4">
          <span className="flex flex-col leading-none">
            <span className="text-[13px] font-bold tracking-[0.04em] text-slate-300">
              平均恢复率
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400/90">
              AVG RECOVERY RATING
            </span>
          </span>
          <span className="font-mono text-[23px] font-medium tracking-[-0.03em] text-slate-100 lg:text-[27px]">
            {(avgRecovery * 100).toFixed(1)}%
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              avgRecovery >= 0.9
                ? "bg-cyan-400"
                : avgRecovery >= 0.7
                  ? "bg-amber-400"
                  : "bg-rose-400"
            )}
            style={{ width: `${avgRecovery * 100}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-mono text-slate-500/70">
          <span>0% / 完全退化</span>
          <span>50%</span>
          <span>100% / 接近全新</span>
        </div>
      </div>
    </div>
  )
}
