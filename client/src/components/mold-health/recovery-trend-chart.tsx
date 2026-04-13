"use client"

import { useMemo } from "react"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { MoldHealthEvent } from "@/lib/mold-health-types"

const AXIS_TICK_STEP = 5
const LEFT_AXIS_MAX = 50
const BAR_STANDARD_COLOR = "#2C7B8E"
const BAR_HIGH_RISK_COLOR = "#E63946"
const BAR_CRITICAL_COLOR = "#8B0000"
const INTERVAL_HEALTHY_COLOR = "#22C55E"
const INTERVAL_WARNING_COLOR = "#F59E0B"
const INTERVAL_CRITICAL_COLOR = "#DC2626"
const MUTED_AXIS_COLOR = "#64748B"
const GRID_COLOR = "rgba(71, 85, 105, 0.28)"
const LINE_COLOR = "#94A3B8"

const LEFT_AXIS_TICKS = Array.from(
  { length: Math.floor(LEFT_AXIS_MAX / AXIS_TICK_STEP) + 1 },
  (_, index) => index * AXIS_TICK_STEP
)

type TrendPoint = {
  id: string
  timestamp: Date
  xAxisKey: string
  label: string
  fullLabel: string
  type: MoldHealthEvent["type"]
  typeZh: string
  typeEn: string
  symptom: string
  downtimeHours: number
  downtimeSeverity: { labelZh: string; color: string }
  interval: number | null
  intervalSeverity: { labelZh: string; color: string }
}

type TooltipPoint = {
  payload: TrendPoint
}

type TrendTooltipProps = {
  active?: boolean
  payload?: Array<TooltipPoint>
}

function formatHours(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function formatTimestamp(value: Date) {
  return value.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  })
}

function getDowntimeSeverity(value: number) {
  if (value >= 24) return { labelZh: "重大", color: BAR_CRITICAL_COLOR }
  if (value >= 12) return { labelZh: "严重", color: BAR_HIGH_RISK_COLOR }
  return { labelZh: "正常", color: BAR_STANDARD_COLOR }
}

function getFaultIntervalSeverity(value: number | null) {
  if (value === null) return { labelZh: "起始", color: MUTED_AXIS_COLOR }
  if (value < 24) return { labelZh: "临界", color: INTERVAL_CRITICAL_COLOR }
  if (value < 72) return { labelZh: "警告", color: INTERVAL_WARNING_COLOR }
  return { labelZh: "健康", color: INTERVAL_HEALTHY_COLOR }
}

function buildTrendPoints(events: MoldHealthEvent[]) {
  const sortedEvents = [...events]
    .filter((event) => event.type !== "CHECKUP")
    .sort((left, right) => {
      const timeDelta = left.timestamp.getTime() - right.timestamp.getTime()
      if (timeDelta !== 0) return timeDelta
      return left.id.localeCompare(right.id)
    })

  return sortedEvents.map((event, index) => {
    const previous = sortedEvents[index - 1]
    const interval =
      previous !== undefined
        ? Math.max(
            0,
            Number(
              (
                (event.timestamp.getTime() - previous.timestamp.getTime()) /
                3_600_000
              ).toFixed(2)
            )
          )
        : null

    return {
      id: event.id,
      timestamp: event.timestamp,
      xAxisKey: `${event.timestamp.toISOString()}::${event.id}`,
      label: formatShortDate(event.timestamp),
      fullLabel: formatTimestamp(event.timestamp),
      type: event.type,
      typeZh: event.type === "SICKNESS" ? "纠正性" : "大修",
      typeEn: event.type === "SICKNESS" ? "Corrective" : "Major Repair",
      symptom: event.symptom,
      downtimeHours: Math.max(0, event.downtimeHours),
      downtimeSeverity: getDowntimeSeverity(event.downtimeHours),
      interval,
      intervalSeverity: getFaultIntervalSeverity(interval),
    } satisfies TrendPoint
  })
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  const faultIntervalLabel =
    point.interval === null
      ? "首条记录 / 起始"
      : `${formatHours(point.interval)}h (${point.intervalSeverity.labelZh})`

  return (
    <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 px-4 py-3 text-xs shadow-[0_18px_60px_rgba(2,6,23,0.5)]">
      <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-100">
        {point.fullLabel}
      </p>
      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">停机时长 / Downtime</span>
          <span className="font-mono text-slate-100">
            {formatHours(point.downtimeHours)}h ({point.downtimeSeverity.labelZh})
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">故障间隔 / Fault Interval</span>
          <span className="font-mono text-slate-100">{faultIntervalLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">事件类型 / Type</span>
          <span className="font-mono text-slate-100">
            {point.typeZh} / {point.typeEn}
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-800/70 bg-slate-950/40 px-6 text-center">
      <div>
        <p className="text-sm font-medium text-slate-200">暂无维修记录</p>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          No Maintenance Records Available
        </p>
      </div>
    </div>
  )
}

export function RecoveryTrendChart({ events }: { events: MoldHealthEvent[] }) {
  const chartData = useMemo(() => buildTrendPoints(events), [events])
  const rightAxisMax = useMemo(() => {
    const intervalMax = chartData.reduce((max, point) => {
      if (point.interval === null) return max
      return Math.max(max, point.interval)
    }, 0)
    return Math.max(LEFT_AXIS_MAX, Math.ceil(intervalMax / 5) * 5)
  }, [chartData])

  if (chartData.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/55">
      <div className="flex flex-col gap-2 border-b border-slate-800/80 px-4 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            VISUAL RISK INTERCEPTOR
          </p>
          <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-slate-100">
            故障间隔 / Fault Interval
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Bars = 停机时长, Line = 故障间隔时间. 阈值与颜色在组件顶部集中配置。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
          <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
            左轴 0-50 / Step 5
          </span>
          <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
            右轴 自适应 / Muted
          </span>
        </div>
      </div>

      <div className="h-[340px] px-3 py-3 md:h-[360px] md:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 14, bottom: 18, left: 0 }}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 6" vertical={false} />

            <XAxis
              dataKey="xAxisKey"
              tickLine={false}
              axisLine={false}
              tickFormatter={(_, index) => chartData[index]?.label ?? ""}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
              interval={0}
              height={28}
            />

            <YAxis
              yAxisId="downtime"
              domain={[0, LEFT_AXIS_MAX]}
              ticks={LEFT_AXIS_TICKS}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
              width={34}
              allowDecimals={false}
            />

            <YAxis
              yAxisId="interval"
              orientation="right"
              domain={[0, rightAxisMax]}
              tickCount={6}
              tickLine={false}
              axisLine={false}
              tick={{ fill: MUTED_AXIS_COLOR, fontSize: 11 }}
              width={38}
              allowDecimals={false}
            />

            <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />

            <Bar
              yAxisId="downtime"
              dataKey="downtimeHours"
              name="停机时长 / Downtime (h)"
              radius={[4, 4, 0, 0]}
              barSize={18}
              isAnimationActive={false}
            >
              {chartData.map((point) => (
                <Cell key={`${point.id}-downtime`} fill={point.downtimeSeverity.color} />
              ))}
            </Bar>

            <Line
              yAxisId="interval"
              type="linear"
              dataKey="interval"
              name="故障间隔 / Fault Interval (h)"
              stroke={LINE_COLOR}
              strokeWidth={2.5}
              dot={(dotProps: any) => {
                const { cx, cy, payload, value } = dotProps
                if (
                  value === null ||
                  typeof cx !== "number" ||
                  typeof cy !== "number" ||
                  !payload
                ) {
                  return <g />
                }

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={payload.intervalSeverity.color}
                    stroke="#020617"
                    strokeWidth={1.5}
                  />
                )
              }}
              activeDot={(dotProps: any) => {
                const { cx, cy, payload, value } = dotProps
                if (
                  value === null ||
                  typeof cx !== "number" ||
                  typeof cy !== "number" ||
                  !payload
                ) {
                  return <g />
                }

                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={payload.intervalSeverity.color}
                    stroke="#E2E8F0"
                    strokeWidth={1.5}
                  />
                )
              }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 px-4 py-3 text-[10px] text-slate-500">
        <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
          停机阈值: &lt;12 正常 / 12-24 严重 / &ge;24 重大
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
          间隔阈值: &lt;24 临界 / 24-72 警告 / &ge;72 健康
        </span>
        <span className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1">
          右轴会在间隔超出 50h 时自动扩展
        </span>
      </div>
    </div>
  )
}
