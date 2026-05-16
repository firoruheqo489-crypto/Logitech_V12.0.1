'use client'

import type { MetricCardData, ChartType } from '@/lib/spc/spc-types'
import type { ParseStatus } from './spc-terminal'
import type {
  SPCComputedResult,
  AttributesSPCResult,
  SpecLimits,
} from '@/lib/spc/spc-math'
import { cn } from '@/lib/utils'

interface SPCMetricsProps {
  parseStatus: ParseStatus
  spcResult: SPCComputedResult | null
  attributesResult: AttributesSPCResult | null
  activeChart: ChartType
  specLimits: SpecLimits
}

const VARIABLES_CHARTS = new Set<ChartType>(['Xbar-R', 'Xbar-s', 'I-MR'])

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A'
  }
  return value.toFixed(4)
}

export function SPCMetrics({
  parseStatus,
  spcResult,
  attributesResult,
  activeChart,
  specLimits,
}: SPCMetricsProps) {
  const isVariablesChart = VARIABLES_CHARTS.has(activeChart)
  const hasOOC = spcResult?.hasOOC || attributesResult?.hasOOC
  const oocCount = spcResult?.oocCount ?? attributesResult?.oocCount ?? 0
  const pointCount =
    spcResult?.points.length ??
    attributesResult?.points.length ??
    parseStatus.rowCount ??
    0
  const hasUSL = specLimits.usl !== null && !Number.isNaN(specLimits.usl)
  const hasLSL = specLimits.lsl !== null && !Number.isNaN(specLimits.lsl)
  const hasBothSpecs = hasUSL && hasLSL

  const getStableNelsonDetail = (): string => {
    if (pointCount < 6) return 'No OOC (<6)'
    if (pointCount < 9) return 'No OOC (<9)'
    if (pointCount < 14) return 'No OOC (<14)'
    return 'Rules 1-4 OK'
  }

  const getCapabilityMetric = ({
    rawValue,
    detail,
    requireBothSpecs = false,
    requireAnySpec = false,
  }: {
    rawValue: number | null | undefined
    detail: string
    requireBothSpecs?: boolean
    requireAnySpec?: boolean
  }): { value: string; detail: string; compactValue: boolean } => {
    if (!isVariablesChart) {
      return { value: 'N/A', detail, compactValue: false }
    }

    if (requireBothSpecs && !hasBothSpecs) {
      return {
        value: 'Set USL/LSL',
        detail: 'Spec Req.',
        compactValue: true,
      }
    }

    if (requireAnySpec && !(hasUSL || hasLSL)) {
      return {
        value: 'Set USL/LSL',
        detail: 'Spec Req.',
        compactValue: true,
      }
    }

    if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) {
      return {
        value: 'Sigma=0',
        detail: 'No Var.',
        compactValue: true,
      }
    }

    return { value: rawValue.toFixed(4), detail, compactValue: false }
  }

  const getNelsonStatus = (): {
    value: string
    detail: string
    highlight: boolean
    isOOC: boolean
  } => {
    if (hasOOC) {
      return {
        value: `OOC x${oocCount}`,
        detail: 'Nelson Rule',
        highlight: true,
        isOOC: true,
      }
    }

    if (spcResult || attributesResult) {
      return {
        value: 'Stable',
        detail: getStableNelsonDetail(),
        highlight: true,
        isOOC: false,
      }
    }

    if (parseStatus.type === 'success' && parseStatus.rowCount) {
      return {
        value: 'Ready',
        detail: `${parseStatus.rowCount} Rows`,
        highlight: true,
        isOOC: false,
      }
    }

    if (parseStatus.type === 'error') {
      return {
        value: 'Parse Err',
        detail: 'Check Input',
        highlight: false,
        isOOC: false,
      }
    }

    return {
      value: 'Standby',
      detail: 'Await Calc',
      highlight: false,
      isOOC: false,
    }
  }

  const nelsonStatus = getNelsonStatus()

  const grandMean = spcResult?.grandMean ?? null
  const estimatedSigma = spcResult?.estimatedSigma ?? null
  const cp = spcResult?.capability?.cp ?? null
  const cpk = spcResult?.capability?.cpk ?? null
  const pp = spcResult?.capability?.pp ?? null
  const ppk = spcResult?.capability?.ppk ?? null
  const cpMetric = getCapabilityMetric({
    rawValue: cp,
    detail: 'Potential Cap.',
    requireBothSpecs: true,
  })
  const cpkMetric = getCapabilityMetric({
    rawValue: cpk,
    detail: 'Centered Cap.',
    requireAnySpec: true,
  })
  const ppMetric = getCapabilityMetric({
    rawValue: pp,
    detail: 'Overall Cap.',
    requireBothSpecs: true,
  })
  const ppkMetric = getCapabilityMetric({
    rawValue: ppk,
    detail: 'Overall Cap.',
    requireAnySpec: true,
  })

  const ppPpkMetric =
    !isVariablesChart
      ? { value: 'N/A', detail: 'Overall Cap.', compactValue: false }
      : !hasBothSpecs
        ? {
            value: 'Need USL/LSL',
            detail: 'Spec limits missing',
            compactValue: true,
          }
        : ppMetric.value === 'Sigma=0' || ppkMetric.value === 'Sigma=0'
          ? {
              value: 'Sigma=0',
              detail: 'No variation',
              compactValue: true,
            }
          : {
              value: `${fmt(pp)}/${fmt(ppk)}`,
              detail: 'Overall Cap.',
              compactValue: true,
            }

  const metrics: Array<
    MetricCardData & {
      detail?: string
      highlight?: boolean
      isOOC?: boolean
      compactValue?: boolean
    }
  > = [
    {
      label: 'Mean',
      value: isVariablesChart ? fmt(grandMean) : 'N/A',
      detail: 'Proc. Center',
    },
    {
      label: 'Sigma Est.',
      value: isVariablesChart ? fmt(estimatedSigma) : 'N/A',
      detail: 'Within Sig.',
    },
    {
      label: 'Cp',
      value: cpMetric.value,
      detail: cpMetric.detail === 'Potential Cap.' ? 'Potential' : cpMetric.detail,
      compactValue: cpMetric.compactValue,
    },
    {
      label: 'Cpk',
      value: cpkMetric.value,
      detail: cpkMetric.detail === 'Centered Cap.' ? 'Centered' : cpkMetric.detail,
      compactValue: cpkMetric.compactValue,
    },
    {
      label: 'Pp/Ppk',
      value: ppPpkMetric.value,
      detail: ppPpkMetric.detail === 'Overall Cap.' ? 'Overall' : ppPpkMetric.detail,
      compactValue: ppPpkMetric.compactValue,
    },
    {
      label: 'Nelson',
      value: nelsonStatus.value,
      detail: nelsonStatus.detail,
      highlight: nelsonStatus.highlight,
      isOOC: nelsonStatus.isOOC,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={cn(
            'spc-metric-card rounded-[20px] p-4',
            metric.highlight && !metric.isOOC && 'spc-metric-card--active',
            metric.isOOC && 'spc-metric-card--ooc',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-[0.12em] text-slate-400">
              {metric.label}
            </span>
            {metric.isOOC && (
              <span className="whitespace-nowrap rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-red-300">
                ALERT
              </span>
            )}
          </div>

          <div
            title={metric.value}
            className={cn(
              'mt-4 whitespace-nowrap font-mono font-semibold leading-none tracking-tight tabular-nums text-slate-100',
              metric.compactValue
                ? metric.value.length > 10
                  ? 'text-[12px] xl:text-[13px] 2xl:text-[14px]'
                  : 'text-[18px] xl:text-[19px] 2xl:text-[20px]'
                : 'text-[22px] xl:text-[23px] 2xl:text-[24px]',
              metric.highlight && !metric.isOOC && 'text-cyan-300',
              metric.isOOC && 'text-red-400',
            )}
          >
            {metric.value}
          </div>

          <div className="mt-2 flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600',
                metric.highlight &&
                  !metric.isOOC &&
                  'bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.75)]',
                metric.isOOC &&
                  'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.65)]',
              )}
            />
            <span
              className={cn(
                'whitespace-nowrap font-mono text-[9px] tracking-[0.05em] text-slate-500',
                metric.isOOC && 'text-red-300/80',
              )}
            >
              {metric.detail}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
