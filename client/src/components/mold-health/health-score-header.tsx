"use client"

import type { MoldAssetInfo } from "@/lib/mold-health-types"
import { getZoneMeta } from "@/pages/dashboard/components/tooling-lifecycle/toolingLifecycleMath"
import { cn } from "@/lib/utils"

const HEALTH_GAUGE_GRADIENT = "linear-gradient(90deg,#7DD3FC 0%,#86EFAC 55%,#FACC15 100%)"

function resolveZoneAccent(zone: ReturnType<typeof getZoneMeta>) {
  switch (zone.zoneId) {
    case "early_failure":
      return {
        barGradient: "linear-gradient(90deg,#67E8F9_0%,#38BDF8_100%)",
        cardClassName: "border-cyan-500/28 bg-cyan-500/6",
        valueClassName: "text-cyan-300",
        subClassName: "text-cyan-200/70",
      }
    case "wear_out":
      return {
        barGradient: "linear-gradient(90deg,#FB7185_0%,#EF4444_100%)",
        cardClassName: "border-rose-500/28 bg-rose-500/6",
        valueClassName: "text-rose-300",
        subClassName: "text-rose-200/70",
      }
    default:
      return {
        barGradient: "linear-gradient(90deg,#86EFAC_0%,#A3E635_100%)",
        cardClassName: "border-emerald-500/24 bg-emerald-500/5",
        valueClassName: "text-emerald-300",
        subClassName: "text-emerald-200/70",
      }
  }
}

function BilingualLabel({
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
      <span className="font-medium">{zh}</span>
      <span className="mt-1 text-[8px] uppercase tracking-[0.28em] text-current/60">
        {en}
      </span>
    </span>
  )
}

function HealthGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 40
  const dashOffset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width="132" height="132" className="-rotate-90">
        <defs>
          <linearGradient id="healthGaugeTrack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="55%" stopColor="#86EFAC" />
            <stop offset="100%" stopColor="#FACC15" />
          </linearGradient>
        </defs>
        <circle
          cx="66"
          cy="66"
          r="40"
          fill="none"
          strokeWidth="7"
          className="stroke-slate-800"
        />
        <circle
          cx="66"
          cy="66"
          r="40"
          fill="none"
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          stroke="url(#healthGaugeTrack)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-[27px] font-medium leading-none tracking-[-0.03em] text-[#7CDB74] lg:text-[29px]">
          {score}
        </span>
      </div>
    </div>
  )
}

function MetricCell({
  labelZh,
  labelEn,
  value,
  sub,
  highlight = false,
  accentClassName,
  valueClassName,
  subClassName,
}: {
  labelZh: string
  labelEn: string
  value: string
  sub: string
  highlight?: boolean
  accentClassName?: string
  valueClassName?: string
  subClassName?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[126px] flex-col items-start justify-between rounded-2xl border border-slate-800/80 bg-slate-950/55 px-5 py-4.5",
        highlight && "border-cyan-500/20 bg-cyan-500/5",
        accentClassName
      )}
    >
      <BilingualLabel
        zh={labelZh}
        en={labelEn}
        className="items-start text-[8px] tracking-[0.12em] text-slate-500"
      />
      <div className="flex flex-col gap-1">
        <span className={cn("font-mono text-[24px] font-medium leading-none tracking-[-0.03em] text-slate-100 lg:text-[27px]", valueClassName)}>
          {value}
        </span>
        <span className={cn("text-[10px] leading-none text-slate-500 lg:text-[11px]", subClassName)}>
          {sub}
        </span>
      </div>
    </div>
  )
}

export function HealthScoreHeader({ asset }: { asset: MoldAssetInfo }) {
  const designLife = asset.designLife > 0 ? asset.designLife : 0
  const lifePercent = designLife > 0 ? (asset.totalShots / designLife) * 100 : 0
  const reliabilityPercent = Math.max(0, Math.min(100, asset.currentReliability * 100))
  const zoneMeta = getZoneMeta(asset.totalShots, Math.max(1, designLife || 1))
  const zoneAccent = resolveZoneAccent(zoneMeta)

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/40 px-8 py-8">
        <div className="flex flex-col gap-7">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-5 text-[9px] font-mono tracking-[0.28em] text-slate-500">
                <span>模具编号</span>
                <span className="ml-2 text-slate-400">/ MOLD NO.</span>
              </div>
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-[35px] font-medium tracking-[-0.045em] text-slate-100 lg:text-[38px]">
                  {asset.moldId}
                </h2>
              </div>
            </div>

            <HealthGauge score={asset.healthScore} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${reliabilityPercent}%`, background: HEALTH_GAUGE_GRADIENT }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 lg:text-[12px]">
              <span>
                可靠度 <span className="text-slate-400">/ Reliability</span>{" "}
                <span className="font-mono text-[12px] font-medium text-slate-100 lg:text-[13px]">
                  {reliabilityPercent.toFixed(1)}%
                </span>
              </span>
              <span>
                寿命消耗 <span className="text-slate-400">/ Life</span>{" "}
                <span className="font-mono text-[12px] font-medium text-slate-100 lg:text-[13px]">{lifePercent.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCell
          labelZh="当前模次"
          labelEn="CURRENT SHOTS"
          value={asset.totalShots > 0 ? asset.totalShots.toLocaleString() : "0"}
          sub="shot count"
          accentClassName={zoneAccent.cardClassName}
          valueClassName={zoneAccent.valueClassName}
          subClassName={zoneAccent.subClassName}
        />
        <MetricCell
          labelZh="设计寿命"
          labelEn="DESIGN LIFE"
          value={designLife > 0 ? designLife.toLocaleString() : "0"}
          sub="--"
        />
        <MetricCell
          labelZh="最近事件"
          labelEn="LAST EVENT"
          value="--"
          sub="--"
        />
        <MetricCell
          labelZh="下次 PM"
          labelEn="NEXT PM"
          value="--"
          sub="--"
        />
      </div>
    </div>
  )
}
