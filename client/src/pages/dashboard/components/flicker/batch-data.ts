import { evaluateFlickerEvidence } from "../laboratory/flicker-rules"

export type Sample = {
  id: string
  fileName: string
  reportType: "flicker" | "pst" | "svm"
  sampleName: string
  voltage: number | null
  measuredAt: string | null
  illuminance: number | null
  f: number | null
  idx: number | null
  pst: number | null
  svm: number | null
  freq: number | null
  result: string | null
  visibility: string | null
  erp: string | null
  standard: string | null
}

export type FlickerParseResult = {
  file_name: string
  report_type: "flicker" | "pst" | "svm"
  sample_name: string | null
  measurement_time: string | null
  average_lx: number | null
  flicker_index: number | null
  flicker_percent: number | null
  pst: number | null
  svm: number | null
  frequency_hz: number | null
  sample_rate_ks: number | null
  sample_time_s: number | null
  voltage_v: number | null
  result: string | null
  visibility: string | null
  erp: string | null
  standard: string | null
  raw_text: string
}

export type TraceStyle = {
  id: string
  className: string
  strokeWidth: number
  dash?: string
  isAnomaly?: boolean
  swatch: string
}

const baseSwatches = [
  { className: "stroke-cyan-400", strokeWidth: 2, swatch: "bg-cyan-400" },
  { className: "stroke-cyan-600/80", strokeWidth: 1.5, dash: "4 2", swatch: "bg-cyan-600/80" },
  { className: "stroke-slate-400", strokeWidth: 1.5, dash: "1 3", swatch: "bg-slate-400" },
  { className: "stroke-indigo-400/80", strokeWidth: 1.5, dash: "6 3", swatch: "bg-indigo-400/80" },
  { className: "stroke-emerald-400/80", strokeWidth: 1.5, dash: "2 2", swatch: "bg-emerald-400/80" },
  { className: "stroke-amber-400/80", strokeWidth: 1.5, dash: "8 4", swatch: "bg-amber-400/80" },
]

const reportTypeOrder: Record<Sample["reportType"], number> = {
  pst: 0,
  svm: 1,
  flicker: 2,
}

export function toSamples(results: FlickerParseResult[]): Sample[] {
  const sortedResults = [...results].sort((left, right) => {
    const orderDelta = reportTypeOrder[left.report_type] - reportTypeOrder[right.report_type]
    if (orderDelta !== 0) return orderDelta
    return left.file_name.localeCompare(right.file_name, "zh-CN")
  })
  const typeCounts = sortedResults.reduce<Record<Sample["reportType"], number>>(
    (counts, result) => ({ ...counts, [result.report_type]: counts[result.report_type] + 1 }),
    { flicker: 0, pst: 0, svm: 0 },
  )
  const seenCounts: Record<Sample["reportType"], number> = { flicker: 0, pst: 0, svm: 0 }

  return sortedResults.map((result) => {
    seenCounts[result.report_type] += 1
    const label = reportTypeLabel(result.report_type)
    const id = typeCounts[result.report_type] > 1 ? `${label}${seenCounts[result.report_type]}` : label

    return {
      id,
      fileName: result.file_name,
      reportType: result.report_type,
      sampleName: result.sample_name || result.file_name,
      voltage: result.voltage_v,
      measuredAt: result.measurement_time,
      illuminance: result.average_lx,
      f: result.flicker_percent,
      idx: result.flicker_index,
      pst: result.pst,
      svm: result.svm,
      freq: result.frequency_hz,
      result: result.result,
      visibility: result.visibility,
      erp: result.erp,
      standard: result.standard,
    }
  })
}

export function delta(values: Array<number | null>) {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (finiteValues.length < 2) return null
  return Math.max(...finiteValues) - Math.min(...finiteValues)
}

export function anomalyIndex(samples: Sample[]): number {
  if (samples.length === 0) return -1
  const failIndex = samples.findIndex(hasFailingEvidence)
  if (failIndex >= 0) return failIndex

  let maxIndex = -1
  for (let i = 0; i < samples.length; i += 1) {
    const current = samples[i].f
    if (current == null) continue
    if (maxIndex < 0 || current > (samples[maxIndex].f ?? -Infinity)) {
      maxIndex = i
    }
  }
  return maxIndex
}

export function hasFailingEvidence(sample: Sample): boolean {
  return evaluateFlickerEvidence({
    flickerPercent: sample.f,
    pstResult: sample.result,
    svmErp: sample.erp,
  }).fail
}

export function hasWatchEvidence(sample: Sample): boolean {
  return evaluateFlickerEvidence({
    flickerPercent: sample.f,
    pstResult: sample.result,
    svmErp: sample.erp,
  }).lowRisk
}

export function reportTypeLabel(type: Sample["reportType"]) {
  if (type === "pst") return "Pst"
  if (type === "svm") return "SVM"
  return "频闪"
}

export function primaryMetric(sample: Sample): number | null {
  if (sample.reportType === "pst") return sample.pst
  if (sample.reportType === "svm") return sample.svm
  return sample.f
}

export function buildTraceStyles(samples: Sample[]): TraceStyle[] {
  const failingIndex = samples.findIndex(hasFailingEvidence)
  return samples.map((sample, index) => {
    if (index === failingIndex) {
      return {
        id: sample.id,
        className: "stroke-[#FF003C]",
        strokeWidth: 2,
        isAnomaly: true,
        swatch: "bg-[#FF003C]",
      }
    }

    const fallback = baseSwatches[index % baseSwatches.length]
    return {
      id: sample.id,
      ...fallback,
    }
  })
}
