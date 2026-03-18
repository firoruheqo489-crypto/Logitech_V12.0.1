'use client'

import { Activity } from 'lucide-react'
import { SPCMetrics } from './spc-metrics'
import { SPCChartArea } from './spc-chart-area'
import { SPCDiagnostic } from './spc-diagnostic'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import type { ParseStatus } from './spc-terminal'
import type { SPCComputedResult, AttributesSPCResult, SpecLimits } from '@/lib/spc/spc-math'

interface SPCMainAreaProps {
  activeChart: ChartType
  parseStatus: ParseStatus
  parsedData: RawDataRow[]
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
  specLimits: SpecLimits
}

export function SPCMainArea({ 
  activeChart, 
  parseStatus, 
  parsedData, 
  spcResult, 
  attributesResult,
  specLimits,
}: SPCMainAreaProps) {
  const isVariablesChart = ['Xbar-R', 'Xbar-s', 'I-MR'].includes(activeChart)

  return (
    <main className="flex flex-1 flex-col gap-6 overflow-auto bg-slate-950 p-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-blue-400/70" />
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-slate-300">
          THE AUDIT
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          // 实时 SPC 监控 & 计算
        </span>
      </div>

      {/* Metric Cards */}
      <SPCMetrics 
        parseStatus={parseStatus} 
        spcResult={spcResult}
        attributesResult={attributesResult}
        activeChart={activeChart}
      />

      {/* Chart Area */}
      <SPCChartArea 
        activeChart={activeChart} 
        parsedData={parsedData} 
        spcResult={spcResult}
        attributesResult={attributesResult}
      />

      {/* Diagnostic Section (Variables charts with valid specs only) */}
      {isVariablesChart && spcResult && (
        <SPCDiagnostic
          spcResult={spcResult}
          parsedData={parsedData}
          specLimits={specLimits}
        />
      )}
    </main>
  )
}
