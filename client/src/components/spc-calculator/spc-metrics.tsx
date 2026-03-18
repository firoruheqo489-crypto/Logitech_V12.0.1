'use client'

import type { MetricCardData, ChartType } from '@/lib/spc/spc-types'
import type { ParseStatus } from './spc-terminal'
import type { SPCComputedResult, AttributesSPCResult } from '@/lib/spc/spc-math'
import { cn } from '@/lib/utils'

interface SPCMetricsProps {
  parseStatus: ParseStatus
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
  activeChart: ChartType
}

// Format number to 4 decimal places
function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A'
  return value.toFixed(4)
}

export function SPCMetrics({ parseStatus, spcResult, attributesResult, activeChart }: SPCMetricsProps) {
  const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(activeChart)

  // Determine OOC status from computed results
  const hasOOC = spcResult?.hasOOC || attributesResult?.hasOOC
  const oocCount = spcResult?.oocCount ?? attributesResult?.oocCount ?? 0

  // Dynamic Nelson Status based on OOC detection
  const getNelsonStatus = (): { value: string; highlight: boolean; isOOC: boolean } => {
    // If we have computed results with OOC points
    if (hasOOC) {
      return { value: `OOC DETECTED (${oocCount})`, highlight: true, isOOC: true }
    }
    
    // If we have computed results but no OOC
    if (spcResult || attributesResult) {
      return { value: 'STABLE', highlight: true, isOOC: false }
    }
    
    // If data is parsed but not yet computed
    if (parseStatus.type === 'success' && parseStatus.rowCount) {
      return { value: `${parseStatus.rowCount} ROWS`, highlight: true, isOOC: false }
    }
    
    // If there's a parse error
    if (parseStatus.type === 'error') {
      return { value: 'PARSE ERROR', highlight: false, isOOC: false }
    }
    
    // Default standby state
    return { value: 'STANDBY', highlight: false, isOOC: false }
  }

  const nelsonStatus = getNelsonStatus()

  // Compute metrics from SPC result
  const grandMean = spcResult?.grandMean ?? null
  const estimatedSigma = spcResult?.estimatedSigma ?? null
  
  // Capability indices from computed result
  const cp = spcResult?.capability?.cp ?? null
  const cpk = spcResult?.capability?.cpk ?? null
  const pp = spcResult?.capability?.pp ?? null
  const ppk = spcResult?.capability?.ppk ?? null

  // Format Pp/Ppk as combined string
  const ppPpkDisplay = (pp !== null || ppk !== null) 
    ? `${fmt(pp)} / ${fmt(ppk)}` 
    : 'N/A / N/A'

  const METRICS: (MetricCardData & { highlight?: boolean; isOOC?: boolean })[] = [
    { 
      label: 'Grand Mean (X\u0304\u0304)', 
      value: isVariablesChart ? fmt(grandMean) : 'N/A',
    },
    { 
      label: 'Est. Sigma (\u03C3\u0302)', 
      value: isVariablesChart ? fmt(estimatedSigma) : 'N/A',
    },
    { 
      label: 'Cp', 
      value: isVariablesChart ? fmt(cp) : 'N/A',
    },
    { 
      label: 'Cpk', 
      value: isVariablesChart ? fmt(cpk) : 'N/A',
    },
    { 
      label: 'Pp / Ppk', 
      value: isVariablesChart ? ppPpkDisplay : 'N/A / N/A',
    },
    { 
      label: 'Nelson Status', 
      value: nelsonStatus.value, 
      unit: nelsonStatus.isOOC ? 'RULES VIOLATED' : (parseStatus.type === 'success' ? 'ingested' : 'rules'), 
      highlight: nelsonStatus.highlight,
      isOOC: nelsonStatus.isOOC,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {METRICS.map((metric) => (
        <div
          key={metric.label}
          className={cn(
            'flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur-md transition-colors',
            metric.highlight && !metric.isOOC && 'border-blue-500/20 bg-blue-500/5',
            metric.isOOC && 'border-red-500/30 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
          )}
        >
          <span className="font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">
            {metric.label}
          </span>
          <span
            className={cn(
              'font-mono text-lg font-semibold tracking-tight tabular-nums text-slate-100',
              metric.highlight && !metric.isOOC && 'text-blue-400',
              metric.isOOC && 'animate-pulse text-red-400'
            )}
          >
            {metric.value}
          </span>
          {metric.unit && (
            <span className={cn(
              'font-mono text-[10px]',
              metric.isOOC ? 'text-red-400/70' : 'text-slate-500'
            )}>
              {metric.unit}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
