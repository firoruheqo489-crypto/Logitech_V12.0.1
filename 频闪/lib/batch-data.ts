export type Sample = {
  id: string
  /** flicker percentage */
  f: number
  /** flicker index */
  idx: number
  /** dominant flicker frequency in Hz */
  freq: number
}

// Mock payload for 4 samples showing dangerous variance. S4 is the anomaly.
export const batch: Sample[] = [
  { id: "S1", f: 2.36, idx: 0.005, freq: 120.0 },
  { id: "S2", f: 2.81, idx: 0.006, freq: 119.6 },
  { id: "S3", f: 3.12, idx: 0.007, freq: 120.4 },
  { id: "S4", f: 8.45, idx: 0.012, freq: 98.5 },
]

export type TraceStyle = {
  id: string
  className: string
  strokeWidth: number
  dash?: string
  isAnomaly?: boolean
  swatch: string
}

// CRITICAL VISUAL HIERARCHY — no rainbow colors.
export const traceStyles: TraceStyle[] = [
  { id: "S1", className: "stroke-cyan-400", strokeWidth: 2, swatch: "bg-cyan-400" },
  { id: "S2", className: "stroke-cyan-600/80", strokeWidth: 1.5, dash: "4 2", swatch: "bg-cyan-600/80" },
  { id: "S3", className: "stroke-slate-400", strokeWidth: 1.5, dash: "1 3", swatch: "bg-slate-400" },
  {
    id: "S4",
    className: "stroke-[#FF003C]",
    strokeWidth: 2,
    isAnomaly: true,
    swatch: "bg-[#FF003C]",
  },
]

export function delta(values: number[]) {
  return Math.max(...values) - Math.min(...values)
}
