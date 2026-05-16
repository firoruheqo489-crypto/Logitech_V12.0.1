'use client'

import { Activity, Radar } from 'lucide-react'
import { SPCMetrics } from './spc-metrics'
import { SPCChartArea } from './spc-chart-area'
import { SPCDiagnostic } from './spc-diagnostic'
import type { ChartType, RawDataRow } from '@/lib/spc/spc-types'
import type { ParseStatus } from './spc-terminal'
import type {
  SPCComputedResult,
  AttributesSPCResult,
  SpecLimits,
} from '@/lib/spc/spc-math'

interface SPCMainAreaProps {
  activeChart: ChartType
  parseStatus: ParseStatus
  parsedData: RawDataRow[]
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
  specLimits: SpecLimits
}

const VARIABLES_CHARTS = new Set<ChartType>(['Xbar-R', 'Xbar-s', 'I-MR'])

export function SPCMainArea({
  activeChart,
  parseStatus,
  parsedData,
  spcResult,
  attributesResult,
  specLimits,
}: SPCMainAreaProps) {
  const isVariablesChart = VARIABLES_CHARTS.has(activeChart)

  const statusTone =
    parseStatus.type === 'error'
      ? 'text-red-300 border-red-400/20 bg-red-500/10'
      : parseStatus.type === 'success'
        ? 'text-cyan-200 border-cyan-400/20 bg-cyan-400/10'
        : 'text-slate-300 border-white/10 bg-white/5'

  const statusLabel =
    parseStatus.type === 'error'
      ? '解析失败'
      : parseStatus.type === 'success'
        ? `已加载 ${parseStatus.rowCount ?? parsedData.length} 行`
        : '等待输入'

  return (
    <main className="spc-main-shell flex flex-1 flex-col gap-6 overflow-auto p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="spc-icon-tile flex size-11 items-center justify-center rounded-2xl">
            <Activity className="size-4 text-cyan-300" />
          </div>
          <div>
            <p className="spc-section-kicker">分析区</p>
            <h2 className="spc-panel-title font-mono text-lg font-semibold tracking-[0.1em]">
              SPC执行面板
            </h2>
            <p className="spc-section-note text-sm">
              用于查看控制界限、过程稳定性与能力分析结果
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-slate-300">
            当前图表 <span className="ml-2 text-cyan-300">{activeChart}</span>
          </div>
          <div
            className={`rounded-full border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] ${statusTone}`}
          >
            {statusLabel}
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] text-slate-300">
            <Radar className="mr-1 inline size-3 text-cyan-300" />
            实时分析
          </div>
        </div>
      </div>

      <SPCMetrics
        parseStatus={parseStatus}
        spcResult={spcResult}
        attributesResult={attributesResult}
        activeChart={activeChart}
        specLimits={specLimits}
      />

      <SPCChartArea
        activeChart={activeChart}
        parsedData={parsedData}
        spcResult={spcResult}
        attributesResult={attributesResult}
      />

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
