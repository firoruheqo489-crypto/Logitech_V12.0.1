'use client'

import type { ComponentType, ReactNode, SVGProps } from 'react'
import { BarChart3, CheckCircle2, TrendingUp } from 'lucide-react'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import type {
  AttributesSPCResult,
  ChartPoint,
  ControlLimits,
  DynamicControlLimits,
  SPCComputedResult,
} from '@/lib/spc/spc-math'
import { cn } from '@/lib/utils'

interface SPCChartAreaProps {
  activeChart: ChartType
  parsedData: RawDataRow[]
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
}

type IconType = ComponentType<SVGProps<SVGSVGElement>>

type ChartRow = {
  index: number
  label: string
  value: number | null
  isOOC?: boolean
  violations?: number[]
  ucl?: number
  lcl?: number
}

interface ChartDescriptor {
  topTitle: string
  topSubtitle: string
  topKey: string
  bottomTitle?: string
  bottomSubtitle?: string
  bottomKey?: string
}

const VARIABLES_CHARTS = new Set<ChartType>(['Xbar-R', 'Xbar-s', 'I-MR'])
const ATTRIBUTES_CHARTS = new Set<ChartType>(['p', 'np', 'c', 'u'])

const CHART_DESCRIPTORS: Record<ChartType, ChartDescriptor> = {
  'Xbar-R': {
    topTitle: 'Xbar均值图',
    topSubtitle: '子组均值轨迹',
    topKey: 'Xbar',
    bottomTitle: 'R极差图',
    bottomSubtitle: '极差轨迹',
    bottomKey: 'R',
  },
  'Xbar-s': {
    topTitle: 'Xbar均值图',
    topSubtitle: '子组均值轨迹',
    topKey: 'Xbar',
    bottomTitle: 's标准差图',
    bottomSubtitle: '标准差轨迹',
    bottomKey: 's',
  },
  'I-MR': {
    topTitle: 'I单值图',
    topSubtitle: '单值测量轨迹',
    topKey: 'I',
    bottomTitle: 'MR移动极差图',
    bottomSubtitle: '移动极差轨迹',
    bottomKey: 'MR',
  },
  p: {
    topTitle: 'p不良率图',
    topSubtitle: '不良率轨迹',
    topKey: 'p',
  },
  np: {
    topTitle: 'np不良数图',
    topSubtitle: '不良数轨迹',
    topKey: 'np',
  },
  c: {
    topTitle: 'c缺陷数图',
    topSubtitle: '缺陷数轨迹',
    topKey: 'c',
  },
  u: {
    topTitle: 'u单位缺陷图',
    topSubtitle: '单位缺陷轨迹',
    topKey: 'u',
  },
}

interface CustomDotProps {
  cx?: number
  cy?: number
  payload?: {
    isOOC?: boolean
  }
}

function OOCDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined) {
    return null
  }

  if (payload?.isOOC) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#3f0d12"
        stroke="#f87171"
        strokeWidth={1.6}
      />
    )
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill="#020617"
      stroke="#67e8f9"
      strokeWidth={1.5}
    />
  )
}

function formatMetric(value: number) {
  return value.toFixed(4)
}

const CHART_THEME = {
  axis: 'rgba(148,163,184,0.3)',
  tick: '#94a3b8',
  series: '#89e7ff',
  pointLabel: '#dbeafe',
  ucl: '#ef4444',
  cl: '#22c55e',
  lcl: '#1d4ed8',
}

function getNiceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const fraction = rawStep / magnitude

  if (fraction <= 1) return magnitude
  if (fraction <= 2) return 2 * magnitude
  if (fraction <= 2.5) return 2.5 * magnitude
  if (fraction <= 5) return 5 * magnitude
  return 10 * magnitude
}

function buildYAxisTicks(minValue: number, maxValue: number, targetTickCount = 6) {
  const safeMin = Math.min(minValue, maxValue)
  const safeMax = Math.max(minValue, maxValue)
  const range = safeMax - safeMin || Math.max(Math.abs(safeMax), 1)
  const step = getNiceStep(range / Math.max(1, targetTickCount - 1))
  const tickStart = Math.floor(safeMin / step) * step
  const tickEnd = Math.ceil(safeMax / step) * step
  const ticks: number[] = []

  for (let value = tickStart; value <= tickEnd + step * 0.5; value += step) {
    ticks.push(Number(value.toFixed(2)))
  }

  return ticks
}

interface PointValueLabelProps {
  x?: number
  y?: number
  value?: number | string
}

function PointValueLabel({ x, y, value }: PointValueLabelProps) {
  if (x === undefined || y === undefined || typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return (
    <text
      x={x}
      y={Math.max(16, y - 10)}
      fill={CHART_THEME.pointLabel}
      fontFamily="monospace"
      fontSize={10}
      textAnchor="middle"
    >
      {value.toFixed(4)}
    </text>
  )
}

function getDomain(values: number[], lower: number, upper: number) {
  const source = values.length > 0 ? values : [lower, upper]
  const minValue = Math.min(...source, lower)
  const maxValue = Math.max(...source, upper)
  const span = maxValue - minValue
  const padding = span > 0 ? span * 0.14 : Math.max(Math.abs(maxValue) * 0.08, 1)

  return [minValue - padding, maxValue + padding] as const
}

function formatRule(rule: number) {
  switch (rule) {
    case 1:
      return '规则1：点超出3σ'
    case 2:
      return '规则2：连续9点位于中心线同侧'
    case 3:
      return '规则3：连续6点单向变化'
    case 4:
      return '规则4：连续14点交替波动'
    default:
      return `规则 ${rule}`
  }
}

interface TooltipPayloadItem {
  value?: number
  payload?: {
    isOOC?: boolean
    violations?: number[]
  }
}

function CustomTooltip({
  active,
  payload,
  label,
  yAxisLabel,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  yAxisLabel: string
}) {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]
  const value =
    typeof point.value === 'number' && !Number.isNaN(point.value)
      ? point.value.toFixed(4)
      : '无'
  const violations = point.payload?.violations ?? []
  const isOOC = point.payload?.isOOC ?? false

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2.5 font-mono text-xs text-slate-100 shadow-[0_18px_36px_rgba(2,6,23,0.6)] backdrop-blur-xl">
      <div className="text-[10px] tracking-[0.16em] text-slate-500">
        样本 {label}
      </div>
      <div className="mt-2 text-slate-100">
        {yAxisLabel}: <span className="text-cyan-300">{value}</span>
      </div>
      {isOOC && (
        <div className="mt-3 border-t border-red-400/15 pt-2">
          <div className="text-[10px] tracking-[0.16em] text-red-300">
            尼尔森规则触发
          </div>
          <div className="mt-1 space-y-1">
            {violations.map((rule) => (
              <div key={rule} className="text-[10px] leading-4 text-red-200/85">
                {formatRule(rule)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChartPlaceholder({
  title,
  subtitle,
  icon: Icon,
  hasData,
}: {
  title: string
  subtitle: string
  icon: IconType
  hasData: boolean
}) {
  return (
    <div className="spc-placeholder-shell spc-chart-corners relative flex min-h-[320px] flex-1 flex-col items-center justify-center overflow-hidden rounded-[22px] px-6 text-center">
      <div className="spc-grid-bg absolute inset-0" />
      <div className="relative z-10 flex max-w-sm flex-col items-center gap-3">
        {hasData ? (
          <CheckCircle2 className="size-9 text-cyan-300/70" />
        ) : (
          <Icon className="size-9 text-slate-600" />
        )}
        <div>
          <p className="spc-section-kicker">{title}</p>
          <p className="mt-2 font-mono text-sm text-slate-200">
            {hasData ? '数据已载入，执行计算后显示图表' : subtitle}
          </p>
          <p className="mt-2 font-mono text-[11px] text-slate-500">
            {hasData ? '图表容器已就绪' : '等待数据输入'}
          </p>
        </div>
      </div>
    </div>
  )
}

function ChartFrame({
  title,
  subtitle,
  meta,
  children,
  isAlert = false,
}: {
  title: string
  subtitle: string
  meta?: ReactNode
  children: ReactNode
  isAlert?: boolean
}) {
  return (
    <div
      className={cn(
        'spc-chart-shell spc-chart-corners relative flex flex-1 flex-col overflow-hidden rounded-[22px]',
        isAlert && 'border-red-400/20 shadow-[0_24px_48px_rgba(127,29,29,0.22)]',
      )}
    >
      <div className="spc-chart-header border-b border-white/8 px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="spc-section-kicker">{title}</p>
            <p className="spc-section-note text-[11px]">{subtitle}</p>
          </div>
          {meta}
        </div>
      </div>
      <div className="relative flex-1 p-3">
        <div className="spc-grid-bg absolute inset-3 rounded-[18px]" />
        <div className="relative z-10 h-[320px]">{children}</div>
      </div>
    </div>
  )
}

function ControlChart({
  title,
  subtitle,
  data,
  limits,
  yAxisLabel,
  showOOCDots = false,
  phaseOneBoundary = 0,
  isAlert = false,
}: {
  title: string
  subtitle: string
  data: ChartRow[]
  limits: ControlLimits
  yAxisLabel: string
  showOOCDots?: boolean
  phaseOneBoundary?: number
  isAlert?: boolean
}) {
  const values = data.flatMap((point) =>
    point.value === null || Number.isNaN(point.value) ? [] : [point.value],
  )
  const [domainMin, domainMax] = getDomain(values, limits.lcl, limits.ucl)
  const yTicks = buildYAxisTicks(domainMin, domainMax)
  const yAxisDomain: [number, number] = [
    yTicks[0] ?? domainMin,
    yTicks[yTicks.length - 1] ?? domainMax,
  ]
  const showPhaseBoundary = phaseOneBoundary > 0 && phaseOneBoundary < data.length

  const meta = (
    <div className="flex flex-wrap items-center gap-2">
      {showPhaseBoundary && (
        <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-cyan-300">
          一期边界 @{phaseOneBoundary}
        </span>
      )}
      <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-400">
        UCL {formatMetric(limits.ucl)}
      </span>
      <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-400">
        CL {formatMetric(limits.centerLine)}
      </span>
      <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-400">
        LCL {formatMetric(limits.lcl)}
      </span>
    </div>
  )

  return (
    <ChartFrame title={title} subtitle={subtitle} meta={meta} isAlert={isAlert}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 4, bottom: 6 }}>
          <CartesianGrid
            stroke="rgba(148,163,184,0.12)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="index"
            tick={{ fill: CHART_THEME.tick, fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: CHART_THEME.axis }}
            tickLine={{ stroke: CHART_THEME.axis }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: CHART_THEME.tick, fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: CHART_THEME.axis }}
            tickLine={{ stroke: CHART_THEME.axis }}
            domain={yAxisDomain}
            ticks={yTicks}
            tickFormatter={(value: number) => value.toFixed(2)}
            tickMargin={8}
            width={64}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              fill: CHART_THEME.tick,
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          />
          <Tooltip content={<CustomTooltip yAxisLabel={yAxisLabel} />} />

          {showPhaseBoundary && (
            <ReferenceLine
              x={phaseOneBoundary}
              stroke="#22d3ee"
              strokeDasharray="6 4"
              strokeWidth={1.4}
            />
          )}

          <ReferenceLine
            y={limits.ucl}
            stroke={CHART_THEME.ucl}
            strokeDasharray="6 4"
            strokeWidth={1.2}
          />
          <ReferenceLine
            y={limits.centerLine}
            stroke={CHART_THEME.cl}
            strokeDasharray="6 4"
            strokeWidth={1.2}
          />
          <ReferenceLine
            y={limits.lcl}
            stroke={CHART_THEME.lcl}
            strokeDasharray="6 4"
            strokeWidth={1.2}
          />

          <Line
            type="linear"
            dataKey="value"
            stroke={CHART_THEME.series}
            strokeWidth={1.8}
            dot={
              showOOCDots
                ? <OOCDot />
                : {
                    fill: '#020617',
                    stroke: '#67e8f9',
                    strokeWidth: 1.4,
                    r: 3,
                  }
            }
            activeDot={{
              fill: '#67e8f9',
              stroke: '#020617',
              strokeWidth: 2,
              r: 5,
            }}
            connectNulls={false}
            isAnimationActive={false}
          >
            <LabelList dataKey="value" content={<PointValueLabel />} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

function AttributesChart({
  title,
  subtitle,
  data,
  limits,
  yAxisLabel,
  isDynamic,
  phaseOneBoundary = 0,
  isAlert = false,
}: {
  title: string
  subtitle: string
  data: ChartRow[]
  limits: ControlLimits | DynamicControlLimits
  yAxisLabel: string
  isDynamic: boolean
  phaseOneBoundary?: number
  isAlert?: boolean
}) {
  const values = data.flatMap((point) =>
    point.value === null || Number.isNaN(point.value) ? [] : [point.value],
  )

  const upperValues = isDynamic
    ? (limits as DynamicControlLimits).ucl
    : [(limits as ControlLimits).ucl]
  const lowerValues = isDynamic
    ? (limits as DynamicControlLimits).lcl
    : [(limits as ControlLimits).lcl]

  const lower = Math.min(...lowerValues)
  const upper = Math.max(...upperValues)
  const [domainMin, domainMax] = getDomain(values, lower, upper)
  const clampedDomainMin = Math.max(0, domainMin)
  const yTicks = buildYAxisTicks(clampedDomainMin, domainMax)
  const yAxisDomain: [number, number] = [
    yTicks[0] ?? clampedDomainMin,
    yTicks[yTicks.length - 1] ?? domainMax,
  ]
  const showPhaseBoundary = phaseOneBoundary > 0 && phaseOneBoundary < data.length

  const meta = (
    <div className="flex flex-wrap items-center gap-2">
      {showPhaseBoundary && (
        <span className="rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-cyan-300">
          一期边界 @{phaseOneBoundary}
        </span>
      )}
      <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-400">
        CL {formatMetric(limits.centerLine)}
      </span>
      <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-400">
        {isDynamic ? '动态界限' : '静态界限'}
      </span>
    </div>
  )

  return (
    <ChartFrame title={title} subtitle={subtitle} meta={meta} isAlert={isAlert}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 4, bottom: 6 }}>
          <CartesianGrid
            stroke="rgba(148,163,184,0.12)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="index"
            tick={{ fill: CHART_THEME.tick, fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: CHART_THEME.axis }}
            tickLine={{ stroke: CHART_THEME.axis }}
            tickMargin={8}
          />
          <YAxis
            tick={{ fill: CHART_THEME.tick, fontSize: 10, fontFamily: 'monospace' }}
            axisLine={{ stroke: CHART_THEME.axis }}
            tickLine={{ stroke: CHART_THEME.axis }}
            domain={yAxisDomain}
            ticks={yTicks}
            tickFormatter={(value: number) => value.toFixed(2)}
            tickMargin={8}
            width={64}
            label={{
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              fill: CHART_THEME.tick,
              fontSize: 10,
              fontFamily: 'monospace',
            }}
          />
          <Tooltip content={<CustomTooltip yAxisLabel={yAxisLabel} />} />

          {showPhaseBoundary && (
            <ReferenceLine
              x={phaseOneBoundary}
              stroke="#22d3ee"
              strokeDasharray="6 4"
              strokeWidth={1.4}
            />
          )}

          <ReferenceLine
            y={limits.centerLine}
            stroke={CHART_THEME.cl}
            strokeDasharray="6 4"
            strokeWidth={1.2}
          />

          {isDynamic ? (
            <>
              <Line
                type="linear"
                dataKey="ucl"
                stroke={CHART_THEME.ucl}
                strokeDasharray="6 4"
                strokeWidth={1.2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="lcl"
                stroke={CHART_THEME.lcl}
                strokeDasharray="6 4"
                strokeWidth={1.2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </>
          ) : (
            <>
              <ReferenceLine
                y={(limits as ControlLimits).ucl}
                stroke={CHART_THEME.ucl}
                strokeDasharray="6 4"
                strokeWidth={1.2}
              />
              <ReferenceLine
                y={(limits as ControlLimits).lcl}
                stroke={CHART_THEME.lcl}
                strokeDasharray="6 4"
                strokeWidth={1.2}
              />
            </>
          )}

          <Line
            type="linear"
            dataKey="value"
            stroke={CHART_THEME.series}
            strokeWidth={1.8}
            dot={<OOCDot />}
            activeDot={{
              fill: '#67e8f9',
              stroke: '#020617',
              strokeWidth: 2,
              r: 5,
            }}
            isAnimationActive={false}
          >
            <LabelList dataKey="value" content={<PointValueLabel />} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

export function SPCChartArea({
  activeChart,
  parsedData,
  spcResult,
  attributesResult,
}: SPCChartAreaProps) {
  const hasData = parsedData.length > 0
  const isVariablesChart = VARIABLES_CHARTS.has(activeChart)
  const isAttributesChart = ATTRIBUTES_CHARTS.has(activeChart)
  const descriptor = CHART_DESCRIPTORS[activeChart]

  if (spcResult && isVariablesChart) {
    const primaryData: ChartRow[] = spcResult.points.map((point: ChartPoint) => ({
      index: point.index,
      label: point.label,
      value: point.primary,
      isOOC: point.isOOC,
      violations: point.violations,
    }))

    const secondaryData: ChartRow[] = spcResult.points.map((point: ChartPoint) => ({
      index: point.index,
      label: point.label,
      value: point.secondary,
    }))

    return (
      <div className="flex flex-1 flex-col gap-4">
        <ControlChart
          title={descriptor.topTitle}
          subtitle={descriptor.topSubtitle}
          data={primaryData}
          limits={spcResult.primaryLimits}
          yAxisLabel={descriptor.topKey}
          showOOCDots
          phaseOneBoundary={spcResult.phaseOneBoundary}
          isAlert={spcResult.hasOOC}
        />
        <ControlChart
          title={descriptor.bottomTitle ?? '副图'}
          subtitle={descriptor.bottomSubtitle ?? '副图轨迹'}
          data={secondaryData}
          limits={spcResult.secondaryLimits}
          yAxisLabel={descriptor.bottomKey ?? 'R'}
          phaseOneBoundary={spcResult.phaseOneBoundary}
        />
      </div>
    )
  }

  if (attributesResult && isAttributesChart) {
    const chartData: ChartRow[] = attributesResult.points.map((point, index) => ({
      index: point.index,
      label: point.label,
      value: point.primary,
      isOOC: point.isOOC,
      violations: point.violations,
      ucl: attributesResult.isDynamic
        ? (attributesResult.limits as DynamicControlLimits).ucl[index]
        : (attributesResult.limits as ControlLimits).ucl,
      lcl: attributesResult.isDynamic
        ? (attributesResult.limits as DynamicControlLimits).lcl[index]
        : (attributesResult.limits as ControlLimits).lcl,
    }))

    return (
      <div className="flex flex-1 flex-col gap-4">
        <AttributesChart
          title={descriptor.topTitle}
          subtitle={descriptor.topSubtitle}
          data={chartData}
          limits={attributesResult.limits}
          yAxisLabel={descriptor.topKey}
          isDynamic={attributesResult.isDynamic}
          phaseOneBoundary={attributesResult.phaseOneBoundary}
          isAlert={attributesResult.hasOOC}
        />
      </div>
    )
  }

  if (isVariablesChart) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <ChartPlaceholder
          title={descriptor.topTitle}
          subtitle="执行后将在这里显示主图"
          icon={TrendingUp}
          hasData={hasData}
        />
        <ChartPlaceholder
          title={descriptor.bottomTitle ?? '副图'}
          subtitle="执行后将在这里显示副图"
          icon={BarChart3}
          hasData={hasData}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ChartPlaceholder
        title={descriptor.topTitle}
        subtitle="执行后将在这里显示计数型图表"
        icon={TrendingUp}
        hasData={hasData}
      />
    </div>
  )
}
