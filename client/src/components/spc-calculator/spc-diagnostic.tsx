'use client'

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity } from 'lucide-react'
import type { SPCComputedResult, SpecLimits } from '@/lib/spc/spc-math'
import type { RawDataRow } from '@/lib/spc/spc-types'

interface SPCDiagnosticProps {
  spcResult: SPCComputedResult
  parsedData: RawDataRow[]
  specLimits: SpecLimits
}

function toFixedOrNA(value: number | null | undefined, digits: number) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '无'
  }
  return value.toFixed(digits)
}

function generateHistogramWithCurve(values: number[], binCount = 12) {
  if (values.length === 0) {
    return { bins: [], stdDev: 0, maxCount: 0 }
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const rawStdDev = Math.sqrt(variance)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || Math.max(Math.abs(mean) * 0.1, 1)
  const stdDev = rawStdDev || span / 6 || 1
  const binWidth = span / binCount

  const bins = Array.from({ length: binCount }, (_, index) => {
    const binStart = min + index * binWidth
    const binEnd = index === binCount - 1 ? min + span : binStart + binWidth
    return {
      binStart,
      binEnd,
      midpoint: binStart + (binEnd - binStart) / 2,
      count: 0,
      curveY: 0,
    }
  })

  for (const value of values) {
    const offset = Math.min(Math.floor((value - min) / binWidth), binCount - 1)
    const safeIndex = Number.isFinite(offset) ? Math.max(0, offset) : 0
    bins[safeIndex].count += 1
  }

  const maxCount = Math.max(...bins.map((bin) => bin.count), 1)

  const binsWithCurve = bins.map((bin) => {
    const x = bin.midpoint
    const pdf =
      (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * ((x - mean) / stdDev) ** 2)

    return {
      ...bin,
      curveY: pdf * values.length * binWidth,
    }
  })

  return { bins: binsWithCurve, stdDev, maxCount }
}

function HistogramTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    payload?: {
      binStart: number
      binEnd: number
      count: number
    }
  }>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const datum = payload[0].payload
  if (!datum || datum.count === 0) {
    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2.5 font-mono text-xs text-slate-100 shadow-[0_18px_36px_rgba(2,6,23,0.6)] backdrop-blur-xl">
      <div className="text-[10px] tracking-[0.16em] text-slate-500">
        直方图区间
      </div>
      <div className="mt-2 text-slate-300">
        范围:
        <span className="ml-1 text-cyan-300">
          {datum.binStart.toFixed(3)} - {datum.binEnd.toFixed(3)}
        </span>
      </div>
      <div className="mt-1 text-slate-300">
        频次: <span className="text-slate-100">{datum.count}</span>
      </div>
    </div>
  )
}

function DistributionHistogram({
  values,
  specLimits,
  grandMean,
}: {
  values: number[]
  specLimits: SpecLimits
  grandMean: number
}) {
  const { bins, stdDev, maxCount } = generateHistogramWithCurve(values, 12)
  const hasUSL = specLimits.usl !== null
  const hasLSL = specLimits.lsl !== null

  return (
    <div className="spc-diagnostic-card rounded-[22px] p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="spc-section-kicker">分布分析</p>
          <h3 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
            直方图与正态曲线
          </h3>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-slate-300">
          样本数 {values.length}
        </div>
      </div>

      <div className="relative h-[320px]">
        <div className="spc-grid-bg absolute inset-0 rounded-[18px]" />
        <div className="relative z-10 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={bins} margin={{ top: 10, right: 18, left: 4, bottom: 6 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="midpoint"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: 'rgba(148,163,184,0.12)' }}
                tickLine={false}
                tickFormatter={(value: number) => value.toFixed(2)}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, Math.max(2, maxCount * 1.25)]}
              />
              <Tooltip content={<HistogramTooltip />} />

              {hasUSL && (
                <ReferenceLine x={specLimits.usl!} stroke="#fb7185" strokeWidth={1.4} />
              )}
              {hasLSL && (
                <ReferenceLine x={specLimits.lsl!} stroke="#fb7185" strokeWidth={1.4} />
              )}
              <ReferenceLine
                x={grandMean}
                stroke="#67e8f9"
                strokeDasharray="4 4"
                strokeWidth={1.2}
              />

              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {bins.map((bin, index) => {
                  const isOutsideSpec =
                    (hasUSL && bin.midpoint > specLimits.usl!) ||
                    (hasLSL && bin.midpoint < specLimits.lsl!)

                  return (
                    <Cell
                      key={`hist-${index}`}
                      fill={isOutsideSpec ? '#ef4444' : '#0ea5e9'}
                      fillOpacity={isOutsideSpec ? 0.35 : 0.32}
                      stroke={isOutsideSpec ? '#f87171' : '#67e8f9'}
                      strokeWidth={1}
                    />
                  )
                })}
              </Bar>

              <Line
                type="monotone"
                dataKey="curveY"
                stroke="#67e8f9"
                strokeWidth={2.1}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            均值
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(grandMean, 4)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            Sigma
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(stdDev, 4)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            USL
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(specLimits.usl, 4)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            LSL
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(specLimits.lsl, 4)}
          </div>
        </div>
      </div>
    </div>
  )
}

function estimatePPM(z: number): string {
  const absZ = Math.abs(z)

  if (absZ >= 6) return '< 1'
  if (absZ >= 5) return '< 1'
  if (absZ >= 4) return '32'
  if (absZ >= 3) return '1,350'
  if (absZ >= 2) return '22,750'
  if (absZ >= 1) return '158,655'
  return '> 500,000'
}

function CapabilityAnalysis({
  grandMean,
  estimatedSigma,
  specLimits,
}: {
  grandMean: number
  estimatedSigma: number
  specLimits: SpecLimits
}) {
  const hasUSL = specLimits.usl !== null
  const hasLSL = specLimits.lsl !== null
  const safeSigma = estimatedSigma > 0 ? estimatedSigma : 1e-6
  const processLower = grandMean - 3 * safeSigma
  const processUpper = grandMean + 3 * safeSigma
  const processSpread = 6 * safeSigma
  const toleranceWidth =
    hasUSL && hasLSL ? specLimits.usl! - specLimits.lsl! : null

  const zLSL = hasLSL ? (grandMean - specLimits.lsl!) / safeSigma : null
  const zUSL = hasUSL ? (specLimits.usl! - grandMean) / safeSigma : null

  const allValues = [
    processLower,
    processUpper,
    ...(hasLSL ? [specLimits.lsl!] : []),
    ...(hasUSL ? [specLimits.usl!] : []),
  ]
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const padding = (maxValue - minValue || 1) * 0.18
  const scaleMin = minValue - padding
  const scaleMax = maxValue + padding
  const scaleRange = scaleMax - scaleMin || 1

  const toPercent = (value: number) => ((value - scaleMin) / scaleRange) * 100

  const processLeftPct = toPercent(processLower)
  const processRightPct = toPercent(processUpper)
  const meanPct = toPercent(grandMean)
  const lslPct = hasLSL ? toPercent(specLimits.lsl!) : 0
  const uslPct = hasUSL ? toPercent(specLimits.usl!) : 100

  const isIncapable =
    (hasLSL && processLower < specLimits.lsl!) ||
    (hasUSL && processUpper > specLimits.usl!)

  return (
    <div className="spc-diagnostic-card rounded-[22px] p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="spc-section-kicker">能力分析</p>
          <h3 className="spc-panel-title font-mono text-sm font-semibold tracking-[0.1em]">
            能力包络图
          </h3>
        </div>
        <div
          className={`rounded-full px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] ${
            isIncapable
              ? 'border border-red-400/20 bg-red-500/10 text-red-300'
              : 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
          }`}
        >
          {isIncapable ? '能力风险' : '能力满足'}
        </div>
      </div>

      <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-5">
        <div className="mb-3 flex justify-between font-mono text-[10px] tracking-[0.14em] text-slate-500">
          <span>{scaleMin.toFixed(2)}</span>
          <span>{scaleMax.toFixed(2)}</span>
        </div>

        <div className="relative h-4 rounded-full bg-slate-900/90">
          {hasLSL && (
            <div
              className="absolute top-1/2 h-7 w-px -translate-y-1/2 bg-slate-200/80"
              style={{ left: `${lslPct}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[9px] text-slate-400">
                LSL
              </span>
            </div>
          )}

          {hasUSL && (
            <div
              className="absolute top-1/2 h-7 w-px -translate-y-1/2 bg-slate-200/80"
              style={{ left: `${uslPct}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[9px] text-slate-400">
                USL
              </span>
            </div>
          )}

          <div
            className={`absolute top-0 h-4 rounded-full ${
              isIncapable
                ? 'bg-red-500/35 ring-1 ring-inset ring-red-400/55'
                : 'bg-cyan-400/25 ring-1 ring-inset ring-cyan-300/50'
            }`}
            style={{
              left: `${Math.max(0, processLeftPct)}%`,
              width: `${Math.max(1, Math.min(100, processRightPct) - Math.max(0, processLeftPct))}%`,
            }}
          />

          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/60 bg-white"
            style={{ left: `calc(${meanPct}% - 6px)` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 font-mono text-[10px] tracking-[0.14em] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-3 w-4 rounded-full bg-cyan-400/25 ring-1 ring-inset ring-cyan-300/50" />
            6Sigma范围
          </div>
          <div className="flex items-center gap-2">
            <span className="h-5 w-px bg-slate-200/80" />
            规格界限
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border border-white/60 bg-white" />
            均值
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            公差宽度
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(toleranceWidth, 4)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            6Sigma范围
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(processSpread, 4)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            至LSL的Z值
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(zLSL, 2)}
          </div>
          {zLSL !== null && (
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              估算PPM {estimatePPM(zLSL)}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-2.5">
          <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500">
            至USL的Z值
          </div>
          <div className="mt-1 font-mono text-sm text-slate-100">
            {toFixedOrNA(zUSL, 2)}
          </div>
          {zUSL !== null && (
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              估算PPM {estimatePPM(zUSL)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SPCDiagnostic({
  spcResult,
  parsedData,
  specLimits,
}: SPCDiagnosticProps) {
  const hasUSL = specLimits.usl !== null && !Number.isNaN(specLimits.usl)
  const hasLSL = specLimits.lsl !== null && !Number.isNaN(specLimits.lsl)

  if (!hasUSL || !hasLSL) {
    return null
  }

  const allValues = parsedData.flatMap((row) =>
    row.values.filter((value) => !Number.isNaN(value)),
  )

  if (allValues.length === 0) {
    return null
  }

  return (
    <section className="mt-2 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="spc-icon-tile flex size-9 items-center justify-center rounded-2xl">
          <Activity className="size-4 text-cyan-300" />
        </div>
        <div>
          <p className="spc-section-kicker">诊断区</p>
          <p className="spc-section-note text-sm">
            只有同时定义 LSL 和 USL 时才显示能力诊断
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <DistributionHistogram
          values={allValues}
          specLimits={specLimits}
          grandMean={spcResult.grandMean}
        />
        <CapabilityAnalysis
          grandMean={spcResult.grandMean}
          estimatedSigma={spcResult.estimatedSigma}
          specLimits={specLimits}
        />
      </div>
    </section>
  )
}
