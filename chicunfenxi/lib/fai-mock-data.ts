import { generateSPCData } from "@/components/fai/spc-distribution-chart"

// FAI list items - aggregatedStatus will be computed dynamically from cavity data
export const faiItemsBase = [
  { id: "fai1", label: "FAI 1", cavities: 16 },
  { id: "fai2", label: "FAI 2", cavities: 16 },
  { id: "fai3", label: "FAI 3", cavities: 16 },
  { id: "fai4", label: "FAI 4", cavities: 8 },
  { id: "fai5", label: "FAI 5", cavities: 16 },
  { id: "fai6", label: "FAI 6", cavities: 4 },
  { id: "fai7", label: "FAI 7", cavities: 16 },
  { id: "fai8", label: "FAI 8", cavities: 8 },
  { id: "fai9", label: "FAI 9", cavities: 16 },
  { id: "fai10", label: "FAI 10", cavities: 16 },
  { id: "fai11", label: "FAI 11", cavities: 4 },
  { id: "fai12", label: "FAI 12", cavities: 16 },
]

// Tolerance specifications per FAI
export const faiSpecs: Record<
  string,
  {
    nominal: number
    usl: number
    lsl: number
    actual: number
    unit: string
    stddev: number
  }
> = {
  fai1: {
    nominal: 12.5,
    usl: 12.65,
    lsl: 12.35,
    actual: 12.523,
    unit: "mm",
    stddev: 0.042,
  },
  fai2: {
    nominal: 8.0,
    usl: 8.1,
    lsl: 7.9,
    actual: 7.987,
    unit: "mm",
    stddev: 0.028,
  },
  fai3: {
    nominal: 25.4,
    usl: 25.55,
    lsl: 25.25,
    actual: 25.582,
    unit: "mm",
    stddev: 0.06,
  },
  fai4: {
    nominal: 5.0,
    usl: 5.08,
    lsl: 4.92,
    actual: 5.012,
    unit: "mm",
    stddev: 0.02,
  },
  fai5: {
    nominal: 18.2,
    usl: 18.35,
    lsl: 18.05,
    actual: 18.328,
    unit: "mm",
    stddev: 0.055,
  },
  fai6: {
    nominal: 3.175,
    usl: 3.225,
    lsl: 3.125,
    actual: 3.181,
    unit: "mm",
    stddev: 0.015,
  },
  fai7: {
    nominal: 45.0,
    usl: 45.2,
    lsl: 44.8,
    actual: 44.967,
    unit: "mm",
    stddev: 0.058,
  },
  fai8: {
    nominal: 10.0,
    usl: 10.1,
    lsl: 9.9,
    actual: 10.034,
    unit: "mm",
    stddev: 0.025,
  },
  fai9: {
    nominal: 30.0,
    usl: 30.15,
    lsl: 29.85,
    actual: 30.172,
    unit: "mm",
    stddev: 0.07,
  },
  fai10: {
    nominal: 6.35,
    usl: 6.42,
    lsl: 6.28,
    actual: 6.358,
    unit: "mm",
    stddev: 0.018,
  },
  fai11: {
    nominal: 15.0,
    usl: 15.12,
    lsl: 14.88,
    actual: 15.043,
    unit: "mm",
    stddev: 0.032,
  },
  fai12: {
    nominal: 22.0,
    usl: 22.15,
    lsl: 21.85,
    actual: 22.128,
    unit: "mm",
    stddev: 0.055,
  },
}

// Pure deterministic PRNG - returns nth value in sequence given seed
function mulberry32(seed: number, n: number): number {
  let s = seed
  for (let i = 0; i <= n; i++) {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    s = (t ^ (t >>> 14)) >>> 0
  }
  return s / 4294967296
}

// Generate cavity data with tri-state status: OK / +NG / -NG
export function generateCavityData(
  faiId: string,
  count: number
): Array<{
  id: string
  label: string
  value: number
  status: "OK" | "+NG" | "-NG"
}> {
  const spec = faiSpecs[faiId]
  if (!spec) return []

  // Deterministic seed based on faiId
  const idNum = parseInt(faiId.replace(/\D/g, ""), 10) || 1
  const baseSeed = idNum * 73856093

  const cavities = []
  const toleranceRange = spec.usl - spec.lsl
  
  // Pre-computed offsets to avoid Box-Muller transcendentals (cross-platform consistency)
  // These represent normalized z-scores that produce a realistic distribution
  const zOffsets = [
    0.12, -0.45, 0.78, -0.23, 1.52, -0.89, 0.34, -1.21,
    0.67, -0.56, 1.89, -0.12, 0.45, -1.67, 0.23, -0.78,
    1.34, -0.34, 0.56, -1.45, 0.89, -0.67, 1.12, -0.45,
    0.23, -1.78, 1.67, -0.23, 0.78, -0.89, 0.45, -1.34,
  ]
  
  for (let i = 1; i <= count; i++) {
    // Use deterministic PRNG to select a z-offset index and add jitter
    const r = mulberry32(baseSeed, i)
    const zIndex = Math.floor(r * zOffsets.length)
    const jitter = (mulberry32(baseSeed, i + 100) - 0.5) * 0.3
    const z = zOffsets[zIndex] + jitter
    
    // Spread factor: make ~10-15% of values fall outside spec limits
    const spreadFactor = toleranceRange * 0.5
    const value = spec.actual + z * spreadFactor
    
    let status: "OK" | "+NG" | "-NG" = "OK"
    if (value > spec.usl) {
      status = "+NG"
    } else if (value < spec.lsl) {
      status = "-NG"
    }
    cavities.push({
      id: `${faiId}-cav${i}`,
      label: `CAV${i}`,
      value: parseFloat(value.toFixed(4)),
      status,
    })
  }
  return cavities
}

// Generate SPC chart data for a given FAI (returns { data, nominal })
export function generateSPCChartData(faiId: string) {
  const spec = faiSpecs[faiId]
  if (!spec) return { data: [], nominal: 0 }
  return generateSPCData(spec.actual, spec.stddev, spec.usl, spec.lsl)
}
