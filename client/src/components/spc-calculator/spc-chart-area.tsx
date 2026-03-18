'use client'

import { BarChart3, TrendingUp, CheckCircle2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import type { 
  SPCComputedResult, 
  AttributesSPCResult, 
  ControlLimits, 
  DynamicControlLimits,
  ChartPoint 
} from '@/lib/spc/spc-math'

interface SPCChartAreaProps {
  activeChart: ChartType
  parsedData: RawDataRow[]
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
}

// ─── Custom Dot Renderer for OOC Detection ───────────────────────────────────
interface CustomDotProps {
  cx?: number
  cy?: number
  payload?: { isOOC?: boolean; violations?: number[] }
}

function OOCDot({ cx, cy, payload }: CustomDotProps) {
  if (cx === undefined || cy === undefined) return null
  
  const isOOC = payload?.isOOC ?? false
  
  // OOC point: solid red ring with dark fill
  if (isOOC) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#450a0a"
        stroke="#ef4444"
        strokeWidth={1.5}
      />
    )
  }
  
  // Normal point: hollow ring (premium UI hallmark)
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill="#020617"
      stroke="#38bdf8"
      strokeWidth={1.5}
    />
  )
}

// ─── Chart Placeholder (for empty state) ─────────────────────────────────────
function ChartPlaceholder({
  title,
  subtitle,
  icon: Icon,
  hasData,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  hasData: boolean
}) {
  return (
    <div className="relative flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
      {/* Grid overlay */}
      <div className="spc-grid-bg absolute inset-0" />
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        {hasData ? (
          <CheckCircle2 className="size-8 text-blue-500/50" />
        ) : (
          <Icon className="size-8 text-slate-600" />
        )}
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {title}
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          {hasData ? 'DATA LOADED - PENDING COMPUTATION... / 数据已加载 - 等待计算...' : subtitle}
        </span>
      </div>
    </div>
  )
}

// ─── Custom Tooltip for OOC Details ──────────────────────────────────────────
interface TooltipPayloadItem {
  value: number
  name: string
  payload?: {
    isOOC?: boolean
    violations?: number[]
    index?: number
    label?: string
  }
}

function CustomTooltip({ 
  active, 
  payload, 
  label,
  yAxisLabel 
}: { 
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  yAxisLabel: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0]
  const isOOC = data.payload?.isOOC ?? false
  const violations = data.payload?.violations ?? []

  const violationLabels: Record<number, string> = {
    1: 'Rule 1: Point beyond 3-sigma / 规则1: 点超出3σ',
    2: 'Rule 2: 9 points same side of CL / 规则2: 9点同侧',
    3: 'Rule 3: 6 points trending / 规则3: 6点趋势',
    4: 'Rule 4: 14 points alternating / 规则4: 14点交替',
  }

  return (
    <div 
      className="rounded-lg border font-mono text-xs"
      style={{ 
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        borderColor: isOOC ? 'rgba(239, 68, 68, 0.5)' : 'rgba(51, 65, 85, 0.5)',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div className="mb-1 text-slate-400">
        Sample / 样本 {label}
      </div>
      <div className="text-slate-100">
        {yAxisLabel}: {typeof data.value === 'number' ? data.value.toFixed(4) : 'N/A'}
      </div>
      {isOOC && (
        <div className="mt-2 border-t border-red-500/30 pt-2">
          <div className="mb-1 font-bold text-red-400">OOC DETECTED / 失控检出</div>
          {violations.map((v) => (
            <div key={v} className="text-[10px] text-red-400/80">
              {violationLabels[v] ?? `Rule ${v}`}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Control Chart Component (Static Limits) ─────────────────────────────────
function ControlChart({
  title,
  data,
  limits,
  yAxisLabel,
  isFullHeight = false,
  showOOCDots = false,
  phaseOneBoundary = 0,
}: {
  title: string
  data: Array<{ index: number; label: string; value: number | null; isOOC?: boolean; violations?: number[] }>
  limits: ControlLimits
  yAxisLabel: string
  isFullHeight?: boolean
  showOOCDots?: boolean
  phaseOneBoundary?: number
}) {
  // Filter out null values for domain calculation
  const validValues = data.map(d => d.value).filter((v): v is number => v !== null)
  const minValue = Math.min(...validValues, limits.lcl)
  const maxValue = Math.max(...validValues, limits.ucl)
  const padding = (maxValue - minValue) * 0.15

  // Check if Phase I boundary should be shown
  const showPhaseBoundary = phaseOneBoundary > 0 && phaseOneBoundary < data.length
  const boundaryIndex = showPhaseBoundary ? phaseOneBoundary : null

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md ${isFullHeight ? 'flex-1' : 'flex-1'}`}>
      {/* Chart Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-2.5">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {title}
        </span>
        {showPhaseBoundary && (
          <span className="ml-2 rounded-md bg-slate-800/70 px-2 py-0.5 font-mono text-[9px] text-slate-500">
            PHASE I LOCKED / 阶段I锁定 @ {phaseOneBoundary}
          </span>
        )}
        <div className="ml-auto flex items-center gap-4 font-mono text-[9px] text-slate-400">
          <span>UCL / 上控制限: <span className="text-slate-100">{limits.ucl.toFixed(4)}</span></span>
          <span>CL / 中心线: <span className="text-slate-100">{limits.centerLine.toFixed(4)}</span></span>
          <span>LCL / 下控制限: <span className="text-slate-100">{limits.lcl.toFixed(4)}</span></span>
        </div>
      </div>
      
      {/* Chart Body */}
      <div className="flex-1 p-3" style={{ minHeight: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid 
              stroke="#1e293b" 
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.4}
            />
            <XAxis
              dataKey="index"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#1e293b' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              domain={[minValue - padding, maxValue + padding]}
              tickFormatter={(value) => value.toFixed(2)}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            <Tooltip
              content={<CustomTooltip yAxisLabel={yAxisLabel} />}
            />
            
            {/* Phase I Boundary Vertical Line */}
            {boundaryIndex !== null && (
              <ReferenceLine
                x={boundaryIndex}
                stroke="#64748b"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: 'PHASE I / 阶段I',
                  position: 'insideTopLeft',
                  fill: '#64748b',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              />
            )}
            
            {/* UCL Reference Line - Thin muted amber */}
            <ReferenceLine
              y={limits.ucl}
              stroke="#d97706"
              strokeDasharray="4 4"
              strokeWidth={1}
              opacity={0.5}
              label={{
                value: 'UCL',
                position: 'right',
                fill: '#64748b',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />
            
            {/* Center Line - Slate muted */}
            <ReferenceLine
              y={limits.centerLine}
              stroke="#64748b"
              strokeWidth={1}
              opacity={0.6}
              label={{
                value: 'CL',
                position: 'right',
                fill: '#64748b',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />
            
            {/* LCL Reference Line - Thin muted amber */}
            <ReferenceLine
              y={limits.lcl}
              stroke="#d97706"
              strokeDasharray="4 4"
              strokeWidth={1}
              opacity={0.5}
              label={{
                value: 'LCL',
                position: 'right',
                fill: '#64748b',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />
            
            {/* Data Line - Razor-sharp precision */}
            <Line
              type="linear"
              dataKey="value"
              stroke="#38bdf8"
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={showOOCDots ? <OOCDot /> : {
                fill: '#020617',
                stroke: '#38bdf8',
                strokeWidth: 1.5,
                r: 3,
              }}
              activeDot={{
                fill: '#38bdf8',
                stroke: '#020617',
                strokeWidth: 2,
                r: 5,
              }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Attributes Chart Component (Dynamic Limits for p/u) ─────────────────────
function AttributesChart({
  title,
  data,
  limits,
  yAxisLabel,
  isDynamic,
  phaseOneBoundary = 0,
}: {
  title: string
  data: Array<{ index: number; label: string; value: number; ucl?: number; lcl?: number; isOOC?: boolean; violations?: number[] }>
  limits: ControlLimits | DynamicControlLimits
  yAxisLabel: string
  isDynamic: boolean
  phaseOneBoundary?: number
}) {
  // For domain calculation
  const validValues = data.map(d => d.value)
  let allUcl: number[]
  let allLcl: number[]
  
  if (isDynamic) {
    const dynLimits = limits as DynamicControlLimits
    allUcl = dynLimits.ucl
    allLcl = dynLimits.lcl
  } else {
    const staticLimits = limits as ControlLimits
    allUcl = [staticLimits.ucl]
    allLcl = [staticLimits.lcl]
  }

  const minValue = Math.min(...validValues, ...allLcl)
  const maxValue = Math.max(...validValues, ...allUcl)
  const padding = (maxValue - minValue) * 0.15

  // Enrich data with dynamic limits if needed
  const enrichedData = data.map((d, i) => ({
    ...d,
    ucl: isDynamic ? (limits as DynamicControlLimits).ucl[i] : (limits as ControlLimits).ucl,
    lcl: isDynamic ? (limits as DynamicControlLimits).lcl[i] : (limits as ControlLimits).lcl,
  }))

  // Check if Phase I boundary should be shown
  const showPhaseBoundary = phaseOneBoundary > 0 && phaseOneBoundary < data.length
  const boundaryIndex = showPhaseBoundary ? phaseOneBoundary : null

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl backdrop-blur-md">
      {/* Chart Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-2.5">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          {title}
        </span>
        {showPhaseBoundary && (
          <span className="ml-2 rounded-md bg-slate-800/70 px-2 py-0.5 font-mono text-[9px] text-slate-500">
            PHASE I LOCKED / 阶段I锁定 @ {phaseOneBoundary}
          </span>
        )}
        <div className="ml-auto flex items-center gap-4 font-mono text-[9px] text-slate-400">
          {isDynamic ? (
            <span className="text-amber-400">DYNAMIC LIMITS / 动态控制限 (variable n / 变量n)</span>
          ) : (
            <>
              <span>UCL / 上控制限: <span className="text-slate-100">{(limits as ControlLimits).ucl.toFixed(4)}</span></span>
              <span>CL / 中心线: <span className="text-slate-100">{limits.centerLine.toFixed(4)}</span></span>
              <span>LCL / 下控制限: <span className="text-slate-100">{(limits as ControlLimits).lcl.toFixed(4)}</span></span>
            </>
          )}
        </div>
      </div>
      
      {/* Chart Body */}
      <div className="flex-1 p-3" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={enrichedData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid 
              stroke="#1e293b" 
              strokeDasharray="3 3"
              vertical={false}
              opacity={0.4}
            />
            <XAxis
              dataKey="index"
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#1e293b' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              domain={[Math.max(0, minValue - padding), maxValue + padding]}
              tickFormatter={(value) => value.toFixed(3)}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
                fontSize: 10,
                fontFamily: 'monospace',
              }}
            />
            <Tooltip
              content={<CustomTooltip yAxisLabel={yAxisLabel} />}
            />
            
            {/* Phase I Boundary Vertical Line */}
            {boundaryIndex !== null && (
              <ReferenceLine
                x={boundaryIndex}
                stroke="#64748b"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: 'PHASE I / 阶段I',
                  position: 'insideTopLeft',
                  fill: '#64748b',
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}
              />
            )}
            
            {/* Center Line - Slate muted */}
            <ReferenceLine
              y={limits.centerLine}
              stroke="#64748b"
              strokeWidth={1}
              opacity={0.6}
              label={{
                value: 'CL',
                position: 'right',
                fill: '#64748b',
                fontSize: 9,
                fontFamily: 'monospace',
              }}
            />

            {/* For static limits, draw fixed UCL/LCL */}
            {!isDynamic && (
              <>
                <ReferenceLine
                  y={(limits as ControlLimits).ucl}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  opacity={0.5}
                  label={{
                    value: 'UCL',
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine
                  y={(limits as ControlLimits).lcl}
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  opacity={0.5}
                  label={{
                    value: 'LCL',
                    position: 'right',
                    fill: '#64748b',
                    fontSize: 9,
                    fontFamily: 'monospace',
                  }}
                />
              </>
            )}

            {/* For dynamic limits, draw UCL/LCL as lines */}
            {isDynamic && (
              <>
                <Line
                  type="linear"
                  dataKey="ucl"
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  opacity={0.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="lcl"
                  stroke="#d97706"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  opacity={0.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </>
            )}
            
            {/* Data Line with OOC dots - Razor-sharp precision */}
            <Line
              type="linear"
              dataKey="value"
              stroke="#38bdf8"
              strokeWidth={1.5}
              isAnimationActive={false}
              dot={<OOCDot />}
              activeDot={{
                fill: '#38bdf8',
                stroke: '#020617',
                strokeWidth: 2,
                r: 5,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Main Chart Area Export ──────────────────────────────────────────────────
export function SPCChartArea({ activeChart, parsedData, spcResult, attributesResult }: SPCChartAreaProps) {
  const hasData = parsedData.length > 0
  const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(activeChart)
  const isAttributesChart = ['p', 'np', 'c', 'u'].includes(activeChart)

  const chartLabels: Record<ChartType, { top: string; bottom: string; topKey: string; bottomKey: string }> = {
    'Xbar-R': { top: 'X\u0304 CHART / 均值图 (Subgroup Mean / 子组均值)', bottom: 'R CHART / 极差图 (Range / 极差)', topKey: 'X\u0304', bottomKey: 'R' },
    'Xbar-s': { top: 'X\u0304 CHART / 均值图 (Subgroup Mean / 子组均值)', bottom: 's CHART / 标准差图 (Std Dev / 标准差)', topKey: 'X\u0304', bottomKey: 's' },
    'I-MR': { top: 'I CHART / 单值图 (Individual / 单值)', bottom: 'MR CHART / 移动极差图 (Moving Range / 移动极差)', topKey: 'I', bottomKey: 'MR' },
    p: { top: 'p CHART / 不合格品率图 (Fraction Defective / 不合格品率)', bottom: '', topKey: 'p', bottomKey: '' },
    np: { top: 'np CHART / 不合格品数图 (Defective Count / 不合格品数)', bottom: '', topKey: 'np', bottomKey: '' },
    c: { top: 'c CHART / 缺陷数图 (Defect Count / 缺陷数)', bottom: '', topKey: 'c', bottomKey: '' },
    u: { top: 'u CHART / 单位缺陷数图 (Defects Per Unit / 单位缺陷数)', bottom: '', topKey: 'u', bottomKey: '' },
  }

  const labels = chartLabels[activeChart]

  // ─── Variables Charts: Dual View ───────────────────────────────────────────
  if (spcResult && isVariablesChart) {
    // Transform data for primary chart (xBar or Individual) with OOC flags
    const primaryData = spcResult.points.map((p: ChartPoint) => ({
      index: p.index,
      label: p.label,
      value: p.primary,
      isOOC: p.isOOC,
      violations: p.violations,
    }))

    // Transform data for secondary chart (R, s, or MR) - no OOC detection
    const secondaryData = spcResult.points.map((p: ChartPoint) => ({
      index: p.index,
      label: p.label,
      value: p.secondary,
    }))

    return (
      <div className="flex flex-1 flex-col gap-4">
        <ControlChart
          title={labels.top}
          data={primaryData}
          limits={spcResult.primaryLimits}
          yAxisLabel={labels.topKey}
          showOOCDots={true}
          phaseOneBoundary={spcResult.phaseOneBoundary}
        />
        <ControlChart
          title={labels.bottom}
          data={secondaryData}
          limits={spcResult.secondaryLimits}
          yAxisLabel={labels.bottomKey}
          showOOCDots={false}
          phaseOneBoundary={spcResult.phaseOneBoundary}
        />
      </div>
    )
  }

  // ─── Attributes Charts: Single View ────────────────────────────────────────
  if (attributesResult && isAttributesChart) {
    const chartData = attributesResult.points.map((p, i) => ({
      index: p.index,
      label: p.label,
      value: p.primary,
      isOOC: p.isOOC,
      violations: p.violations,
      ucl: attributesResult.isDynamic
        ? (attributesResult.limits as DynamicControlLimits).ucl[i]
        : (attributesResult.limits as ControlLimits).ucl,
      lcl: attributesResult.isDynamic
        ? (attributesResult.limits as DynamicControlLimits).lcl[i]
        : (attributesResult.limits as ControlLimits).lcl,
    }))

    return (
      <div className="flex flex-1 flex-col gap-4">
        <AttributesChart
          title={labels.top}
          data={chartData}
          limits={attributesResult.limits}
          yAxisLabel={labels.topKey}
          isDynamic={attributesResult.isDynamic}
          phaseOneBoundary={attributesResult.phaseOneBoundary}
        />
      </div>
    )
  }

  // ─── Empty State ──────────────────────────────────────────────────────────
  if (isVariablesChart) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <ChartPlaceholder
          title={labels.top}
          subtitle="AWAITING DATA INJECTION..."
          icon={TrendingUp}
          hasData={hasData}
        />
        <ChartPlaceholder
          title={labels.bottom}
          subtitle="AWAITING DATA INJECTION..."
          icon={BarChart3}
          hasData={hasData}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ChartPlaceholder
        title={labels.top}
        subtitle="AWAITING DATA INJECTION..."
        icon={TrendingUp}
        hasData={hasData}
      />
    </div>
  )
}
