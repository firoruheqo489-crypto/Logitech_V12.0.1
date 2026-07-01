export type Sample = {
  id: string
  fileName: string
  sampleName: string
  voltage: number | null
  measuredAt: string | null
  illuminance: number | null
  f: number
  idx: number
  freq: number
}

export type FlickerParseResult = {
  file_name: string
  sample_name: string | null
  measurement_time: string | null
  average_lx: number | null
  flicker_index: number | null
  flicker_percent: number | null
  frequency_hz: number | null
  sample_rate_ks: number | null
  sample_time_s: number | null
  voltage_v: number | null
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

export function toSamples(results: FlickerParseResult[]): Sample[] {
  return results.map((result, index) => ({
    id: `样本${index + 1}`,
    fileName: result.file_name,
    sampleName: result.sample_name || result.file_name,
    voltage: result.voltage_v,
    measuredAt: result.measurement_time,
    illuminance: result.average_lx,
    f: result.flicker_percent ?? 0,
    idx: result.flicker_index ?? 0,
    freq: result.frequency_hz ?? 0,
  }))
}

export function delta(values: number[]) {
  return Math.max(...values) - Math.min(...values)
}

export function anomalyIndex(samples: Sample[]): number {
  if (samples.length === 0) return -1
  let maxIndex = 0
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].f > samples[maxIndex].f) {
      maxIndex = i
    }
  }
  return maxIndex
}

export function buildTraceStyles(samples: Sample[]): TraceStyle[] {
  const worstIndex = anomalyIndex(samples)
  return samples.map((sample, index) => {
    if (index === worstIndex) {
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
