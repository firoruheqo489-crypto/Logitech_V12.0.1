'use client'

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts'
import { Activity } from 'lucide-react'
import type { SPCComputedResult, SpecLimits } from '@/lib/spc/spc-math'
import type { RawDataRow } from '@/lib/spc/spc-types'

interface SPCDiagnosticProps {
  spcResult: SPCComputedResult
  parsedData: RawDataRow[]
  specLimits: SpecLimits
}

// ─── Helper: Generate Histogram Bins with Bell Curve ─────────────────────────
function generateHistogramWithCurve(values: number[], binCount: number = 12) {
  if (values.length === 0) return { bins: [], mean: 0, stdDev: 0, maxCount: 0 }
  
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const binWidth = range / binCount
  
  // Initialize bins
  const bins: { 
    binStart: number
    binEnd: number
    count: number
    midpoint: number
    curveY: number | null
  }[] = []
  
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth
    const binEnd = binStart + binWidth
    bins.push({
      binStart,
      binEnd,
      count: 0,
      midpoint: binStart + binWidth / 2,
      curveY: null,
    })
  }
  
  // Count values in each bin
  for (const value of values) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1)
    if (binIndex >= 0 && binIndex < bins.length) {
      bins[binIndex].count++
    }
  }
  
  const maxCount = Math.max(...bins.map(b => b.count))
  
  // Generate Normal Distribution Curve Points (50 points)
  const curvePoints: { midpoint: number; curveY: number }[] = []
  const curveResolution = 50
  const curveStep = range / curveResolution
  
  for (let i = 0; i <= curveResolution; i++) {
    const x = min + i * curveStep
    const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    const scaledY = pdf * n * binWidth
    curvePoints.push({ midpoint: x, curveY: scaledY })
  }
  
  // Compute curve values on bin midpoints
  const binsWithCurve = bins.map(bin => {
    const x = bin.midpoint
    const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    const scaledY = pdf * n * binWidth
    return { ...bin, curveY: scaledY }
  })
  
  // Add extra curve-only points for smoother line
  const fullCurveData: typeof binsWithCurve = []
  for (let i = 0; i <= curveResolution; i++) {
    const x = min + i * curveStep
    const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    const scaledY = pdf * n * binWidth
    
    const nearBin = binsWithCurve.find(b => Math.abs(b.midpoint - x) < binWidth * 0.3)
    
    if (nearBin) {
      fullCurveData.push({ ...nearBin })
    } else {
      fullCurveData.push({
        binStart: x,
        binEnd: x,
        count: 0,
        midpoint: x,
        curveY: scaledY,
      })
    }
  }
  
  return { bins: binsWithCurve, mean, stdDev, maxCount, fullCurveData }
}

// ─── Custom Tooltip for Histogram ────────────────────────────────────────────
function HistogramTooltip({ 
  active, 
  payload 
}: { 
  active?: boolean
  payload?: Array<{ payload?: { binStart: number; binEnd: number; count: number; curveY: number } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  
  const data = payload[0].payload
  if (!data || data.count === 0) return null
  
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 font-mono text-xs backdrop-blur-xl">
      <div className="text-slate-400">
        Range / 范围: {data.binStart.toFixed(3)} - {data.binEnd.toFixed(3)}
      </div>
      <div className="mt-1 text-slate-100">
        Frequency / 频次: <span className="text-blue-400">{data.count}</span>
      </div>
    </div>
  )
}

// ─── Left Panel: Distribution Histogram + Bell Curve ─────────────────────────
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
  
  // Generate smooth curve data
  const n = values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const binWidth = range / 12
  
  const curveData: { x: number; y: number }[] = []
  for (let i = 0; i <= 60; i++) {
    const x = min + (i / 60) * range
    const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - grandMean) / stdDev, 2))
    const scaledY = pdf * n * binWidth
    curveData.push({ x, y: scaledY })
  }
  
  // Determine if data falls outside specs for coloring
  const hasUSL = specLimits.usl !== null
  const hasLSL = specLimits.lsl !== null
  
  // Combine histogram bins with curve points
  const combinedData = bins.map(bin => ({
    ...bin,
    curveY: curveData.find(c => Math.abs(c.x - bin.midpoint) < binWidth * 0.5)?.y ?? null
  }))
  
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          DISTRIBUTION HISTOGRAM / 分布直方图
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          n / 样本量 = <span className="text-slate-100">{values.length}</span>
        </span>
      </div>
      
      {/* Chart Body */}
      <div className="flex-1" style={{ minHeight: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={combinedData} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
            <CartesianGrid 
              stroke="#1e293b" 
              vertical={false}
            />
            <XAxis
              dataKey="midpoint"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              axisLine={{ stroke: '#334155' }}
              tickLine={{ stroke: '#334155' }}
              domain={[0, maxCount * 1.2]}
              allowDecimals={false}
            />
            <Tooltip content={<HistogramTooltip />} />
            
            {/* USL Reference Line */}
            {hasUSL && (
              <ReferenceLine
                x={specLimits.usl!}
                stroke="#e11d48"
                strokeWidth={1.5}
                label={{
                  value: 'USL',
                  position: 'top',
                  fill: '#94a3b8',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}
            
            {/* LSL Reference Line */}
            {hasLSL && (
              <ReferenceLine
                x={specLimits.lsl!}
                stroke="#e11d48"
                strokeWidth={1.5}
                label={{
                  value: 'LSL',
                  position: 'top',
                  fill: '#94a3b8',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            )}
            
            {/* Grand Mean Line */}
            <ReferenceLine
              x={grandMean}
              stroke="#38bdf8"
              strokeWidth={1}
              strokeDasharray="3 3"
label={{
                  value: '\u0304X / 均值',
                  position: 'top',
                  fill: '#94a3b8',
                  fontSize: 9,
                  fontFamily: 'monospace',
                }}
              />
            
            {/* Histogram Bars - Solid frosted blue glass */}
            <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {combinedData.map((bin, index) => {
                const isOutsideSpec = 
                  (hasUSL && bin.midpoint > specLimits.usl!) ||
                  (hasLSL && bin.midpoint < specLimits.lsl!)
                
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isOutsideSpec ? '#ef4444' : '#3b82f6'}
                    fillOpacity={0.4}
                    stroke={isOutsideSpec ? '#f87171' : '#60a5fa'}
                    strokeWidth={1}
                  />
                )
              })}
            </Bar>
            
            {/* Bell Curve - Prominent sky blue */}
            <Line
              type="monotone"
              dataKey="curveY"
              stroke="#38bdf8"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Helper: Estimate PPM from Z-score ───────────────────────────────────────
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

// ─── Right Panel: Precision Bullet Graph + Statistical Ledger ────────────────
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
  
  // Calculate 6-sigma spread
  const processLower = grandMean - 3 * estimatedSigma
  const processUpper = grandMean + 3 * estimatedSigma
  const processSpread = 6 * estimatedSigma
  
  // Calculate tolerance
  const toleranceWidth = hasUSL && hasLSL ? specLimits.usl! - specLimits.lsl! : 0
  
  // Calculate Z-scores
  const zLSL = hasLSL ? (grandMean - specLimits.lsl!) / estimatedSigma : Infinity
  const zUSL = hasUSL ? (specLimits.usl! - grandMean) / estimatedSigma : Infinity
  
  // PPM estimates
  const ppmLSL = hasLSL ? estimatePPM(zLSL) : 'N/A'
  const ppmUSL = hasUSL ? estimatePPM(zUSL) : 'N/A'
  
  // Calculate common scale for bullet graph
  const allValues = [
    processLower, processUpper,
    ...(hasLSL ? [specLimits.lsl!] : []),
    ...(hasUSL ? [specLimits.usl!] : []),
  ]
  const scaleMin = Math.min(...allValues) - Math.abs(Math.max(...allValues) - Math.min(...allValues)) * 0.15
  const scaleMax = Math.max(...allValues) + Math.abs(Math.max(...allValues) - Math.min(...allValues)) * 0.15
  const scaleRange = scaleMax - scaleMin
  
  // Convert value to percentage position
  const toPercent = (val: number) => ((val - scaleMin) / scaleRange) * 100
  
  // Calculate positions
  const processLeftPct = toPercent(processLower)
  const processRightPct = toPercent(processUpper)
  const processWidthPct = processRightPct - processLeftPct
  const meanPct = toPercent(grandMean)
  
  const lslPct = hasLSL ? toPercent(specLimits.lsl!) : 0
  const uslPct = hasUSL ? toPercent(specLimits.usl!) : 100
  
  // Determine capability status
  const spillsLeft = hasLSL && processLower < specLimits.lsl!
  const spillsRight = hasUSL && processUpper > specLimits.usl!
  const isIncapable = spillsLeft || spillsRight
  
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur-md">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          CAPABILITY ANALYSIS / 过程能力分析
        </span>
        {hasUSL && hasLSL && (
          <span className={`font-mono text-[10px] font-bold ${isIncapable ? 'text-red-400' : 'text-blue-400'}`}>
            {isIncapable ? 'INCAPABLE / 能力不足' : 'CAPABLE / 能力充足'}
          </span>
        )}
      </div>
      
      {/* Part A: Precision Bullet Graph */}
      <div className="mb-10">
        {/* Axis labels */}
        <div className="mb-2 flex justify-between font-mono text-[9px] text-slate-500">
          <span>{scaleMin.toFixed(2)}</span>
          <span>{scaleMax.toFixed(2)}</span>
        </div>
        
        {/* Background Track - Thick and substantial */}
        <div className="relative h-3 w-full rounded-full bg-slate-800">
          {/* LSL Marker */}
          {hasLSL && (
            <div 
              className="absolute top-1/2 z-10 h-5 w-[2px] -translate-y-1/2 bg-slate-300"
              style={{ left: `${lslPct}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-slate-400">
                LSL
              </span>
            </div>
          )}
          
          {/* USL Marker */}
          {hasUSL && (
            <div 
              className="absolute top-1/2 z-10 h-5 w-[2px] -translate-y-1/2 bg-slate-300"
              style={{ left: `${uslPct}%` }}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[8px] text-slate-400">
                USL
              </span>
            </div>
          )}
          
          {/* Process Spread Pill */}
          <div 
            className={`absolute top-0 h-3 rounded-full ${isIncapable ? 'bg-red-500/40 ring-1 ring-inset ring-red-500/70' : 'bg-blue-500/40 ring-1 ring-inset ring-blue-500/70'}`}
            style={{ 
              left: `${Math.max(0, processLeftPct)}%`, 
              width: `${Math.min(processWidthPct, 100 - Math.max(0, processLeftPct))}%` 
            }}
          />
          
          {/* Center Mean Dot */}
          <div 
            className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white"
            style={{ left: `calc(${meanPct}% - 5px)` }}
          />
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-6 font-mono text-[9px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-4 rounded-full bg-blue-500/40 ring-1 ring-inset ring-blue-500/70" />
            <span>6σ Spread / 6σ散布</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-[2px] bg-slate-300" />
            <span>Spec Limits / 规格限</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white" />
            <span>Mean / 均值</span>
          </div>
        </div>
      </div>
      
      {/* Part B: High-Density Statistical Ledger */}
      <div className="mt-auto grid grid-cols-2 gap-x-8 gap-y-6 border-t border-slate-800 pt-6">
        {/* Row 1: Tolerance vs Spread */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">TOLERANCE WIDTH / 公差宽度</div>
          <div className="mt-1 font-mono text-base tracking-tight text-slate-100">
            {hasUSL && hasLSL ? toleranceWidth.toFixed(4) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">6σ SPREAD / 6σ散布</div>
          <div className="mt-1 font-mono text-base tracking-tight text-slate-100">
            {processSpread.toFixed(4)}
          </div>
        </div>
        
        {/* Row 2: Z-Scores */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">Z-LSL / Z下限</div>
          <div className="mt-1 flex items-center font-mono text-base tracking-tight text-slate-100">
            {zLSL < 3 && <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
            {hasLSL ? zLSL.toFixed(2) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">Z-USL / Z上限</div>
          <div className="mt-1 flex items-center font-mono text-base tracking-tight text-slate-100">
            {zUSL < 3 && <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
            {hasUSL ? zUSL.toFixed(2) : 'N/A'}
          </div>
        </div>
        
        {/* Row 3: PPM Estimates */}
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">{'EST. PPM < LSL / 预估PPM<下限'}</div>
          <div className="mt-1 flex items-center font-mono text-base tracking-tight text-slate-100">
            {zLSL < 3 && <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
            {ppmLSL}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">{'EST. PPM > USL / 预估PPM>上限'}</div>
          <div className="mt-1 flex items-center font-mono text-base tracking-tight text-slate-100">
            {zUSL < 3 && <span className="mr-2 h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
            {ppmUSL}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Diagnostic Export ──────────────────────────────────────────────────
export function SPCDiagnostic({ spcResult, parsedData, specLimits }: SPCDiagnosticProps) {
  const hasUSL = specLimits.usl !== null && !isNaN(specLimits.usl)
  const hasLSL = specLimits.lsl !== null && !isNaN(specLimits.lsl)
  
  // Only render if both USL and LSL are provided
  if (!hasUSL || !hasLSL) return null
  
  // Aggregate ALL individual measurements into a single flat array
  const allValues: number[] = parsedData.flatMap(row => row.values.filter(v => !isNaN(v)))
  
  if (allValues.length === 0) return null
  
  return (
    <div className="mt-4 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Activity className="size-3 text-blue-400/70" />
        <h3 className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
          THE DIAGNOSTIC / 诊断面板
        </h3>
        <span className="font-mono text-[9px] text-slate-500">
          // Capability Analysis / 过程能力分析
        </span>
      </div>
      
      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Left: Distribution Histogram + Bell Curve */}
        <DistributionHistogram
          values={allValues}
          specLimits={specLimits}
          grandMean={spcResult.grandMean}
        />
        
        {/* Right: Capability Analysis */}
        <CapabilityAnalysis
          grandMean={spcResult.grandMean}
          estimatedSigma={spcResult.estimatedSigma}
          specLimits={specLimits}
        />
      </div>
    </div>
  )
}
