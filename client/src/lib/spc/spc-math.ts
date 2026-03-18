import type { RawDataRow, ChartType } from './spc-types'

// ─── SPC Constants Dictionary (A2, A3, D3, D4, B3, B4, c4, d2 for n=2..10) ────
export const SPC_CONSTANTS: Record<number, {
  A2: number
  A3: number
  d2: number
  D3: number
  D4: number
  B3: number
  B4: number
  c4: number
}> = {
  2: { A2: 1.880, A3: 2.659, d2: 1.128, D3: 0, D4: 3.267, B3: 0, B4: 3.267, c4: 0.7979 },
  3: { A2: 1.023, A3: 1.954, d2: 1.693, D3: 0, D4: 2.574, B3: 0, B4: 2.568, c4: 0.8862 },
  4: { A2: 0.729, A3: 1.628, d2: 2.059, D3: 0, D4: 2.282, B3: 0, B4: 2.266, c4: 0.9213 },
  5: { A2: 0.577, A3: 1.427, d2: 2.326, D3: 0, D4: 2.114, B3: 0, B4: 2.089, c4: 0.9400 },
  6: { A2: 0.483, A3: 1.287, d2: 2.534, D3: 0, D4: 2.004, B3: 0.030, B4: 1.970, c4: 0.9515 },
  7: { A2: 0.419, A3: 1.182, d2: 2.704, D3: 0.076, D4: 1.924, B3: 0.118, B4: 1.882, c4: 0.9594 },
  8: { A2: 0.373, A3: 1.099, d2: 2.847, D3: 0.136, D4: 1.864, B3: 0.185, B4: 1.815, c4: 0.9650 },
  9: { A2: 0.337, A3: 1.032, d2: 2.970, D3: 0.184, D4: 1.816, B3: 0.239, B4: 1.761, c4: 0.9693 },
  10: { A2: 0.308, A3: 0.975, d2: 3.078, D3: 0.223, D4: 1.777, B3: 0.284, B4: 1.716, c4: 0.9727 },
}

// For I-MR charts, E2 = 2.66 (for n=2 moving range)
export const IMR_E2 = 2.66

// ─── Specification Limits ────────────────────────────────────────────────────
export interface SpecLimits {
  usl: number | null
  target: number | null
  lsl: number | null
}

// ─── Computed Point for Charts (with Nelson Rules) ───────────────────────────
export interface ChartPoint {
  index: number
  label: string
  primary: number     // xBar or Individual value or rate/count for attributes
  secondary: number | null  // R, s, or MR (null for first MR point and attributes)
  // Nelson Rules fields (for primary chart only)
  violations: number[]  // Array of rule numbers violated (1, 2, 3, 4)
  isOOC: boolean        // Out of Control flag
  ucl: number           // UCL for this point
  lcl: number           // LCL for this point
  cl: number            // Center line for this point
}

// ─── Control Limits Structure ────────────────────────────────────────────────
export interface ControlLimits {
  ucl: number
  lcl: number
  centerLine: number
}

// ─── Dynamic Control Limits (for p and u charts with variable sample size) ───
export interface DynamicControlLimits {
  ucl: number[]  // UCL per point
  lcl: number[]  // LCL per point
  centerLine: number
}

// ─── Process Capability Indices ──────────────────────────────────────────────
export interface CapabilityIndices {
  cp: number | null
  cpk: number | null
  pp: number | null
  ppk: number | null
}

// ─── Computed SPC Result (Variables) ─────────────────────────────────────────
export interface SPCComputedResult {
  chartType: ChartType
  points: ChartPoint[]
  primaryLimits: ControlLimits    // For xBar or I chart
  secondaryLimits: ControlLimits  // For R, s, or MR chart
  grandMean: number               // X-double-bar
  avgRange: number                // R-bar or MR-bar
  avgStdDev: number               // s-bar (for Xbar-s)
  estimatedSigma: number          // Process sigma estimate
  subgroupSize: number
  capability: CapabilityIndices   // Cp/Cpk/Pp/Ppk
  hasOOC: boolean                 // True if any point is out of control
  oocCount: number                // Count of OOC points
  phaseOneBoundary: number        // Index of last Phase I point (0 = no freeze)
}

// ─── Computed SPC Result (Attributes) ────────────────────────────────────────
export interface AttributesSPCResult {
  chartType: ChartType
  points: ChartPoint[]
  limits: ControlLimits | DynamicControlLimits
  centerLine: number
  isDynamic: boolean  // true for p and u charts with variable sample size
  hasOOC: boolean     // True if any point is out of control
  oocCount: number    // Count of OOC points
  phaseOneBoundary: number  // Index of last Phase I point (0 = no freeze)
}

// ─── Helper: Calculate Mean ──────────────────────────────────────────────────
function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// ─── Helper: Calculate Range ─────────────────────────────────────────────────
function range(values: number[]): number {
  if (values.length === 0) return 0
  return Math.max(...values) - Math.min(...values)
}

// ─── Helper: Calculate Sample Standard Deviation ─────────────────────────────
function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const squaredDiffs = values.map(v => Math.pow(v - m, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1))
}

// ─── Helper: Calculate Population Standard Deviation ─────────────────────────
function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  const squaredDiffs = values.map(v => Math.pow(v - m, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

// ─── Nelson Rules Engine ─────────────────────────────────────────────────────
// Applies Nelson Rules 1-4 to an array of chart points
// Rule 1: Point beyond 3-sigma (UCL/LCL)
// Rule 2: 9 points in a row on same side of centerline
// Rule 3: 6 points in a row steadily increasing or decreasing
// Rule 4: 14 points alternating up and down
function applyNelsonRules(
  points: Array<{ primary: number; ucl: number; lcl: number; cl: number }>,
): Array<{ violations: number[]; isOOC: boolean }> {
  // State tracking variables
  let consecutiveSameSide = 0
  let currentSide = 0
  let consecutiveTrend = 0
  let trendDir = 0
  let consecutiveAlternating = 0
  let lastDiff = 0

  return points.map((pt, i, arr) => {
    const violations: number[] = []
    const val = pt.primary
    const CL = pt.cl
    const UCL = pt.ucl
    const LCL = pt.lcl

    if (val !== undefined && val !== null && !isNaN(val)) {
      // Rule 1: Point beyond 3-sigma (UCL/LCL)
      if (val > UCL || val < LCL) violations.push(1)

      // Rule 2: 9 points in a row on same side of centerline
      const side = val > CL ? 1 : (val < CL ? -1 : 0)
      if (side === currentSide && side !== 0) {
        consecutiveSameSide++
        if (consecutiveSameSide >= 9) violations.push(2)
      } else {
        currentSide = side
        consecutiveSameSide = 1
      }

      // Rule 3: 6 points in a row steadily increasing or decreasing
      if (i > 0) {
        const diff = val - arr[i - 1].primary
        const dir = diff > 0 ? 1 : (diff < 0 ? -1 : 0)
        if (dir === trendDir && dir !== 0) {
          consecutiveTrend++
          if (consecutiveTrend >= 5) violations.push(3) // 5 intervals = 6 points
        } else {
          trendDir = dir
          consecutiveTrend = 1
        }

        // Rule 4: 14 points alternating up and down
        if (diff * lastDiff < 0) {
          consecutiveAlternating++
          if (consecutiveAlternating >= 13) violations.push(4)
        } else {
          consecutiveAlternating = 1
        }
        lastDiff = diff
      }
    }

    return { violations, isOOC: violations.length > 0 }
  })
}

// ─── Calculate Capability Indices ────────────────────────────────────────────
function calculateCapability(
  grandMean: number,
  estimatedSigma: number,
  allValues: number[],
  specLimits: SpecLimits
): CapabilityIndices {
  const { usl, lsl } = specLimits
  
  // Need both USL and LSL for Cp/Pp, at least one for Cpk/Ppk
  const hasUSL = usl !== null && !isNaN(usl)
  const hasLSL = lsl !== null && !isNaN(lsl)
  
  if (!hasUSL && !hasLSL) {
    return { cp: null, cpk: null, pp: null, ppk: null }
  }

  if (estimatedSigma === 0) {
    return { cp: null, cpk: null, pp: null, ppk: null }
  }

  // Cp = (USL - LSL) / (6 * estimated sigma)
  let cp: number | null = null
  if (hasUSL && hasLSL) {
    cp = (usl! - lsl!) / (6 * estimatedSigma)
  }

  // Cpk = min((USL - mean) / (3*sigma), (mean - LSL) / (3*sigma))
  let cpk: number | null = null
  const cpuValues: number[] = []
  const cplValues: number[] = []
  if (hasUSL) {
    cpuValues.push((usl! - grandMean) / (3 * estimatedSigma))
  }
  if (hasLSL) {
    cplValues.push((grandMean - lsl!) / (3 * estimatedSigma))
  }
  if (cpuValues.length > 0 || cplValues.length > 0) {
    cpk = Math.min(...cpuValues, ...cplValues)
  }

  // Pp uses actual population standard deviation
  const popSigma = populationStdDev(allValues)
  let pp: number | null = null
  let ppk: number | null = null

  if (popSigma > 0) {
    if (hasUSL && hasLSL) {
      pp = (usl! - lsl!) / (6 * popSigma)
    }

    const ppuValues: number[] = []
    const pplValues: number[] = []
    if (hasUSL) {
      ppuValues.push((usl! - grandMean) / (3 * popSigma))
    }
    if (hasLSL) {
      pplValues.push((grandMean - lsl!) / (3 * popSigma))
    }
    if (ppuValues.length > 0 || pplValues.length > 0) {
      ppk = Math.min(...ppuValues, ...pplValues)
    }
  }

  return { cp, cpk, pp, ppk }
}

// ─── Main Variables Calculation Function ─────────────────────────────────────
export function calculateVariablesSPC(
  parsedData: RawDataRow[],
  chartType: ChartType,
  subgroupSize: number,
  specLimits: SpecLimits = { usl: null, target: null, lsl: null },
  phaseOneLimit: number = 0  // k: if > 0 and < length, freeze limits from first k points
): SPCComputedResult | null {
  // Only handle variables charts
  if (!['Xbar-R', 'Xbar-s', 'I-MR'].includes(chartType)) {
    return null
  }

  if (parsedData.length === 0) {
    return null
  }

  // Determine if we should use baseline freeze
  const k = phaseOneLimit
  const useBaseline = k > 0 && k < parsedData.length
  const baselineData = useBaseline ? parsedData.slice(0, k) : parsedData
  const phaseOneBoundary = useBaseline ? k : 0

  const rawPoints: Array<{
    index: number
    label: string
    primary: number
    secondary: number | null
  }> = []
  const primaryValues: number[] = []   // xBar or Individual values (ALL data)
  const secondaryValues: number[] = [] // R, s, or MR values (ALL data)
  const allRawValues: number[] = []    // All individual values for Pp/Ppk (ALL data)
  
  // Baseline values for frozen limits
  const baselinePrimaryValues: number[] = []
  const baselineSecondaryValues: number[] = []
  const baselineRawValues: number[] = []

  if (chartType === 'I-MR') {
    // ─── I-MR Chart Calculation ──────────────────────────────────────────────
    // First pass: collect ALL raw points
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const individual = row.values[0]
      let mr: number | null = null

      if (i > 0) {
        mr = Math.abs(individual - parsedData[i - 1].values[0])
        secondaryValues.push(mr)
        if (!useBaseline || i < k) {
          baselineSecondaryValues.push(mr)
        }
      }

      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: individual,
        secondary: mr,
      })
      primaryValues.push(individual)
      allRawValues.push(individual)
      
      if (!useBaseline || i < k) {
        baselinePrimaryValues.push(individual)
        baselineRawValues.push(individual)
      }
    }

    // Calculate FROZEN limits from baseline OR all data
    const grandMean = mean(baselinePrimaryValues)
    const mrBar = mean(baselineSecondaryValues)
    const d2 = SPC_CONSTANTS[2].d2
    const estimatedSigma = mrBar / d2

    // I Chart limits
    const primaryLimits: ControlLimits = {
      centerLine: grandMean,
      ucl: grandMean + IMR_E2 * mrBar,
      lcl: grandMean - IMR_E2 * mrBar,
    }

    // MR Chart limits
    const { D3, D4 } = SPC_CONSTANTS[2]
    const secondaryLimits: ControlLimits = {
      centerLine: mrBar,
      ucl: D4 * mrBar,
      lcl: D3 * mrBar,
    }

    // Apply FROZEN limits to ALL data points for Nelson Rules
    const pointsWithLimits = rawPoints.map(p => ({
      ...p,
      ucl: primaryLimits.ucl,
      lcl: primaryLimits.lcl,
      cl: primaryLimits.centerLine,
    }))

    const nelsonResults = applyNelsonRules(pointsWithLimits)

    const points: ChartPoint[] = pointsWithLimits.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    // Capability uses all data but frozen sigma
    const capability = calculateCapability(grandMean, estimatedSigma, allRawValues, specLimits)
    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      primaryLimits,
      secondaryLimits,
      grandMean,
      avgRange: mrBar,
      avgStdDev: 0,
      estimatedSigma,
      subgroupSize: 1,
      capability,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }

  } else if (chartType === 'Xbar-R') {
    // ─── Xbar-R Chart Calculation ────────────────────────────────────────────
    const constants = SPC_CONSTANTS[subgroupSize]
    if (!constants) {
      return null
    }

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const xBar = mean(row.values)
      const r = range(row.values)

      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: xBar,
        secondary: r,
      })
      primaryValues.push(xBar)
      secondaryValues.push(r)
      allRawValues.push(...row.values)
      
      if (!useBaseline || i < k) {
        baselinePrimaryValues.push(xBar)
        baselineSecondaryValues.push(r)
        baselineRawValues.push(...row.values)
      }
    }

    // Calculate FROZEN limits from baseline
    const grandMean = mean(baselinePrimaryValues)
    const rBar = mean(baselineSecondaryValues)
    const estimatedSigma = rBar / constants.d2

    const primaryLimits: ControlLimits = {
      centerLine: grandMean,
      ucl: grandMean + constants.A2 * rBar,
      lcl: grandMean - constants.A2 * rBar,
    }

    const secondaryLimits: ControlLimits = {
      centerLine: rBar,
      ucl: constants.D4 * rBar,
      lcl: constants.D3 * rBar,
    }

    // Apply FROZEN limits to ALL data
    const pointsWithLimits = rawPoints.map(p => ({
      ...p,
      ucl: primaryLimits.ucl,
      lcl: primaryLimits.lcl,
      cl: primaryLimits.centerLine,
    }))

    const nelsonResults = applyNelsonRules(pointsWithLimits)

    const points: ChartPoint[] = pointsWithLimits.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const capability = calculateCapability(grandMean, estimatedSigma, allRawValues, specLimits)
    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      primaryLimits,
      secondaryLimits,
      grandMean,
      avgRange: rBar,
      avgStdDev: 0,
      estimatedSigma,
      subgroupSize,
      capability,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }

  } else if (chartType === 'Xbar-s') {
    // ─── Xbar-s Chart Calculation ────────────────────────────────────────────
    const constants = SPC_CONSTANTS[subgroupSize]
    if (!constants) {
      return null
    }

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const xBar = mean(row.values)
      const s = sampleStdDev(row.values)

      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: xBar,
        secondary: s,
      })
      primaryValues.push(xBar)
      secondaryValues.push(s)
      allRawValues.push(...row.values)
      
      if (!useBaseline || i < k) {
        baselinePrimaryValues.push(xBar)
        baselineSecondaryValues.push(s)
        baselineRawValues.push(...row.values)
      }
    }

    // Calculate FROZEN limits from baseline
    const grandMean = mean(baselinePrimaryValues)
    const sBar = mean(baselineSecondaryValues)
    const estimatedSigma = sBar / constants.c4

    const primaryLimits: ControlLimits = {
      centerLine: grandMean,
      ucl: grandMean + constants.A3 * sBar,
      lcl: grandMean - constants.A3 * sBar,
    }

    const secondaryLimits: ControlLimits = {
      centerLine: sBar,
      ucl: constants.B4 * sBar,
      lcl: constants.B3 * sBar,
    }

    // Apply FROZEN limits to ALL data
    const pointsWithLimits = rawPoints.map(p => ({
      ...p,
      ucl: primaryLimits.ucl,
      lcl: primaryLimits.lcl,
      cl: primaryLimits.centerLine,
    }))

    const nelsonResults = applyNelsonRules(pointsWithLimits)

    const points: ChartPoint[] = pointsWithLimits.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const capability = calculateCapability(grandMean, estimatedSigma, allRawValues, specLimits)
    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      primaryLimits,
      secondaryLimits,
      grandMean,
      avgRange: 0,
      avgStdDev: sBar,
      estimatedSigma,
      subgroupSize,
      capability,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }
  }

  return null
}

// ─── Attributes Charts Calculation Function ──────────────────────────────────
export function calculateAttributesSPC(
  parsedData: RawDataRow[],
  chartType: ChartType,
  subgroupSize: number,  // n for np chart (constant sample size)
  phaseOneLimit: number = 0  // k: if > 0 and < length, freeze limits from first k points
): AttributesSPCResult | null {
  // Only handle attributes charts
  if (!['p', 'np', 'c', 'u'].includes(chartType)) {
    return null
  }

  if (parsedData.length === 0) {
    return null
  }

  // Determine if we should use baseline freeze
  const k = phaseOneLimit
  const useBaseline = k > 0 && k < parsedData.length
  const baselineData = useBaseline ? parsedData.slice(0, k) : parsedData
  const phaseOneBoundary = useBaseline ? k : 0

  const rawPoints: Array<{
    index: number
    label: string
    primary: number
    secondary: number | null
    ucl: number
    lcl: number
    cl: number
  }> = []

  if (chartType === 'c') {
    // ─── c Chart: Defects per unit, constant size ────────────────────────────
    // Calculate c-bar from BASELINE only
    const baselineDefects = baselineData.map(row => row.values[0])
    const cBar = mean(baselineDefects)

    // FROZEN UCL/LCL
    const sqrtCBar = Math.sqrt(cBar)
    const ucl = cBar + 3 * sqrtCBar
    const lcl = Math.max(0, cBar - 3 * sqrtCBar)

    // Apply to ALL data
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const c = row.values[0]
      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: c,
        secondary: null,
        ucl,
        lcl,
        cl: cBar,
      })
    }

    const limits: ControlLimits = {
      centerLine: cBar,
      ucl,
      lcl,
    }

    const nelsonResults = applyNelsonRules(rawPoints)
    const points: ChartPoint[] = rawPoints.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      limits,
      centerLine: cBar,
      isDynamic: false,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }

  } else if (chartType === 'np') {
    // ─── np Chart: Defectives count, constant sample size ────────────────────
    // Calculate np-bar from BASELINE only
    const baselineDefectives = baselineData.map(row => row.values[0])
    const npBar = mean(baselineDefectives)
    const n = subgroupSize
    const pBar = npBar / n

    // FROZEN UCL/LCL
    const sqrtTerm = Math.sqrt(npBar * (1 - pBar))
    const ucl = npBar + 3 * sqrtTerm
    const lcl = Math.max(0, npBar - 3 * sqrtTerm)

    // Apply to ALL data
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const np = row.values[0]
      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: np,
        secondary: null,
        ucl,
        lcl,
        cl: npBar,
      })
    }

    const limits: ControlLimits = {
      centerLine: npBar,
      ucl,
      lcl,
    }

    const nelsonResults = applyNelsonRules(rawPoints)
    const points: ChartPoint[] = rawPoints.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      limits,
      centerLine: npBar,
      isDynamic: false,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }

  } else if (chartType === 'p') {
    // ─── p Chart: Fraction defective, variable sample size ───────────────────
    // Calculate p-bar from BASELINE only
    let baselineTotalDefects = 0
    let baselineTotalSampleSize = 0
    
    for (let i = 0; i < baselineData.length; i++) {
      const row = baselineData[i]
      baselineTotalDefects += row.values[0]
      baselineTotalSampleSize += row.values[1]
    }
    
    const pBar = baselineTotalDefects / baselineTotalSampleSize

    // Calculate dynamic limits for ALL data using FROZEN p-bar
    const uclArray: number[] = []
    const lclArray: number[] = []

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const defects = row.values[0]
      const n = row.values[1]
      const p = defects / n

      const sqrtTerm = Math.sqrt((pBar * (1 - pBar)) / n)
      const ucl = pBar + 3 * sqrtTerm
      const lcl = Math.max(0, pBar - 3 * sqrtTerm)
      uclArray.push(ucl)
      lclArray.push(lcl)

      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: p,
        secondary: null,
        ucl,
        lcl,
        cl: pBar,
      })
    }

    const limits: DynamicControlLimits = {
      centerLine: pBar,
      ucl: uclArray,
      lcl: lclArray,
    }

    const nelsonResults = applyNelsonRules(rawPoints)
    const points: ChartPoint[] = rawPoints.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      limits,
      centerLine: pBar,
      isDynamic: true,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }

  } else if (chartType === 'u') {
    // ─── u Chart: Defects per unit, variable sample size ─────────────────────
    // Calculate u-bar from BASELINE only
    let baselineTotalDefects = 0
    let baselineTotalSampleSize = 0
    
    for (let i = 0; i < baselineData.length; i++) {
      const row = baselineData[i]
      baselineTotalDefects += row.values[0]
      baselineTotalSampleSize += row.values[1]
    }
    
    const uBar = baselineTotalDefects / baselineTotalSampleSize

    // Calculate dynamic limits for ALL data using FROZEN u-bar
    const uclArray: number[] = []
    const lclArray: number[] = []

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i]
      const defects = row.values[0]
      const n = row.values[1]
      const u = defects / n

      const sqrtTerm = Math.sqrt(uBar / n)
      const ucl = uBar + 3 * sqrtTerm
      const lcl = Math.max(0, uBar - 3 * sqrtTerm)
      uclArray.push(ucl)
      lclArray.push(lcl)

      rawPoints.push({
        index: i + 1,
        label: row.label,
        primary: u,
        secondary: null,
        ucl,
        lcl,
        cl: uBar,
      })
    }

    const limits: DynamicControlLimits = {
      centerLine: uBar,
      ucl: uclArray,
      lcl: lclArray,
    }

    const nelsonResults = applyNelsonRules(rawPoints)
    const points: ChartPoint[] = rawPoints.map((p, i) => ({
      ...p,
      violations: nelsonResults[i].violations,
      isOOC: nelsonResults[i].isOOC,
    }))

    const oocCount = points.filter(p => p.isOOC).length

    return {
      chartType,
      points,
      limits,
      centerLine: uBar,
      isDynamic: true,
      hasOOC: oocCount > 0,
      oocCount,
      phaseOneBoundary,
    }
  }

  return null
}
